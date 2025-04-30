#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { diffLines, createTwoFilesPatch } from "diff";
import { minimatch } from "minimatch";

import { execSync } from "child_process";

// Schema definitions

// Base task schema that covers common TaskWarrior fields
const taskSchema = z.object({
  uuid: z.string().uuid(),
  description: z.string(),
  status: z.enum(["pending", "completed", "deleted", "waiting", "recurring"]),
  entry: z.string().datetime(), // ISO timestamp
  modified: z.string().datetime().optional(), // ISO timestamp
  due: z.string().optional(), // ISO timestamp
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-z.]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^a-z$/)).optional(),
});

// Request schemas for different operations
const listPendingTasksRequest = z.object({
  project: z
    .string()
    .regex(/^[a-z.]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^a-z$/)).optional(),
});

const listTasksRequest = z.object({
  status: z
    .enum(["pending", "completed", "deleted", "waiting", "recurring"])
    .optional(),
  project: z
    .string()
    .regex(/^[a-z.]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^a-z$/)).optional(),
});

const getTaskRequest = z.object({
  identifier: z.string(),
});

const markTaskDoneRequest = z.object({
  identifier: z.string(),
});

const addTaskRequest = z.object({
  description: z.string(),
  // Optional fields that can be set when adding
  due: z.string().optional(), // ISO timestamp
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-z.]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^a-z$/)).optional(),
});

// Response schemas
const listTasksResponse = z.array(taskSchema);
const getTaskResponse = taskSchema;
const markTaskDoneResponse = taskSchema;
const addTaskResponse = taskSchema;

// Error schema
const errorResponse = z.object({
  error: z.string(),
  code: z.number(),
});

// Server setup
const server = new Server(
  {
    name: "taskwarrior-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_next_tasks",
        description: "Get a list of all pending tasks",
        inputSchema: zodToJsonSchema(listPendingTasksRequest) as ToolInput,
      },
      {
        name: "mark_task_done",
        description: "Mark a task as done (completed)",
        inputSchema: zodToJsonSchema(markTaskDoneRequest) as ToolInput,
      },
      {
        name: "add_task",
        description: "Add a new task",
        inputSchema: zodToJsonSchema(addTaskRequest) as ToolInput,
      },
      {
        name: "list_tasks_json",
        description: "Get a list of tasks as JSON objects based on filters",
        inputSchema: zodToJsonSchema(listTasksRequest) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: z.infer<typeof CallToolRequestSchema>) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "get_next_tasks": {
          const parsed = listPendingTasksRequest.safeParse(args);
          if (!parsed.success) {
            throw new Error(
              `Invalid arguments for get_next_tasks: ${parsed.error}`,
            );
          }
          let task_args = [];
          if (parsed.data.tags) {
            for (let tag of parsed.data.tags) {
              task_args.push(`+${tag}`);
            }
          }
          if (parsed.data.project) {
            task_args.push(`project:${parsed.data.project}`);
          }
          const content = execSync(`task limit: ${task_args.join(" ")} next`, {
            maxBuffer: 1024 * 1024 * 10,
          })
            .toString()
            .trim();
          return {
            content: [{ type: "text", text: content }],
          };
        }

        case "mark_task_done": {
          const parsed = markTaskDoneRequest.safeParse(args);
          if (!parsed.success) {
            throw new Error(
              `Invalid arguments for mark_task_done: ${parsed.error}`,
            );
          }
          const content = execSync(`task ${parsed.data.identifier} done`, {
            maxBuffer: 1024 * 1024 * 10,
          })
            .toString()
            .trim();
          return {
            content: [{ type: "text", text: content }],
          };
        }

        case "add_task": {
          const parsed = addTaskRequest.safeParse(args);
          if (!parsed.success) {
            throw new Error(`Invalid arguments for add_task: ${parsed.error}`);
          }

          let task_args = [parsed.data.description];

          if (parsed.data.due) {
            task_args.push(`due:${parsed.data.due}`);
          }
          if (parsed.data.priority) {
            task_args.push(`priority:${parsed.data.priority}`);
          }
          if (parsed.data.project) {
            task_args.push(`project:${parsed.data.project}`);
          }
          if (parsed.data.tags) {
            task_args.push(...parsed.data.tags.map((tag: string) => `+${tag}`));
          }

          // 1. Add the task
          const addOutput = execSync(`task add ${task_args.join(" ")}`, {
            maxBuffer: 1024 * 1024 * 10,
          })
            .toString()
            .trim();
          // Log confirmation message for debugging/server logs
          console.error(`Task add output: ${addOutput}`);

          // 2. Immediately export the *most recently added* task as JSON
          const jsonOutput = execSync(`task limit:1 entry- export`, {
            maxBuffer: 1024 * 1024 * 10,
          })
            .toString()
            .trim();

          // 3. Check if JSON output is valid and extract the single task object
          let taskJsonString = "";
          if (jsonOutput.startsWith("[")) {
            try {
              const taskArray = JSON.parse(jsonOutput);
              if (taskArray.length > 0) {
                // Stringify just the single task object
                taskJsonString = JSON.stringify(taskArray[0]);
              } else {
                // This case should ideally not happen with limit:1 entry- if the add was successful
                throw new Error(
                  "Task added, but failed to retrieve its JSON immediately after (empty array returned).",
                );
              }
            } catch (parseError) {
              const message =
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError);
              throw new Error(
                `Task added, but failed to parse JSON output from task export: ${message}`,
              );
            }
          } else {
            // Handle cases where task export might not return a JSON array (e.g., errors, unexpected output)
            throw new Error(
              `Task added, but 'task export' did not return a JSON array. Output: ${jsonOutput}`,
            );
          }

          // 4. Return the JSON string of the single task as text content
          return {
            content: [{ type: "text", text: taskJsonString }],
          };
        }

        case "list_tasks_json": {
          const parsed = listTasksRequest.safeParse(args); // Use existing filter schema
          if (!parsed.success) {
            throw new Error(
              `Invalid arguments for list_tasks_json: ${parsed.error}`,
            );
          }

          // Construct filter arguments for the task command
          let filter_args = [];
          if (parsed.data.status)
            filter_args.push(`status:${parsed.data.status}`);
          if (parsed.data.project)
            filter_args.push(`project:${parsed.data.project}`);
          if (parsed.data.tags)
            filter_args.push(
              ...parsed.data.tags.map((tag: string) => `+${tag}`),
            );
          // Add other filters like limit if schema supports them

          // Execute task export
          const jsonOutput = execSync(`task ${filter_args.join(" ")} export`, {
            maxBuffer: 1024 * 1024 * 10,
          })
            .toString()
            .trim();

          // Return the raw JSON string (which represents an array)
          return {
            content: [{ type: "text", text: jsonOutput }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  },
);

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP TaskWarrior Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
