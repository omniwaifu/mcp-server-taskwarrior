#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema as MCPToolSchema, // Renamed to avoid conflict if we define our own ToolSchema
} from "@modelcontextprotocol/sdk/types.js";
// fs, path, os, diffLines, createTwoFilesPatch, minimatch might not be needed here anymore
// import fs from "fs/promises";
// import path from "path";
// import os from "os";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
// import { diffLines, createTwoFilesPatch } from "diff"; // Likely not needed
// import { minimatch } from "minimatch"; // Likely not needed

// import { execSync } from "child_process"; // This will be moved to handlers

// Import handlers
import { handleGetNextTasks } from "./tools/getNextTasks/index.js";
import { handleAddTask } from "./tools/addTask/index.js";
import { markTaskDoneHandler } from "./tools/markTaskDone/index.js";
import { handleListTasks } from "./tools/listTasks/index.js";
import { getTaskDetailsHandler } from "./tools/getTaskDetails/index.js";
import { modifyTaskHandler } from "./tools/modifyTask/index.js";
import { startTaskHandler } from "./tools/startTask/index.js";
import { stopTaskHandler } from "./tools/stopTask/index.js";
import { deleteTaskHandler } from "./tools/deleteTask/index.js";
import { addAnnotationHandler } from "./tools/addAnnotation/index.js";
import { removeAnnotationHandler } from "./tools/removeAnnotation/index.js";

// Import common schemas and types
import {
  ListPendingTasksRequestSchema,
  MarkTaskDoneRequestSchema,
  AddTaskRequestSchema,
  ListTasksRequestSchema,
  GetTaskDetailsRequestSchema,
  ModifyTaskRequestSchema,
  StartTaskRequestSchema,
  StopTaskRequestSchema,
  DeleteTaskRequestSchema,
  AddAnnotationRequestSchema,
  RemoveAnnotationRequestSchema,
  // TaskWarriorTaskSchema, // Not directly used in index.ts anymore for responses
  // ErrorResponseSchema, // Error handling is custom within the CallTool handler
} from "./types/task.js";

// Schema definitions (can be moved to a common types file later - Task 3)

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
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});

// Request schemas for different operations
const listPendingTasksRequest = z.object({
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});

const listTasksRequest = z.object({
  status: z
    .enum(["pending", "completed", "deleted", "waiting", "recurring"])
    .optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});

// const getTaskRequest = z.object({ // Will be handled by its own tool module
//   identifier: z.string(),
// });

const markTaskDoneRequest = z.object({
  idOrUuid: z.string(),
});

const addTaskRequest = z.object({
  description: z.string(),
  // Optional fields that can be set when adding
  due: z.string().optional(), // ISO timestamp
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});

// Response schemas (can also be moved later)
// const listTasksResponse = z.array(taskSchema);
// const getTaskResponse = taskSchema;
// const markTaskDoneResponse = taskSchema;
// const addTaskResponse = taskSchema;

// Error schema (can also be moved later)
// const errorResponse = z.object({
//   error: z.string(),
//   code: z.number(),
// });

// Server setup
const server = new Server(
  {
    name: "taskwarrior-server",
    version: "1.0.0", // Consider updating version or managing it via package.json
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
const ToolInputSchema = MCPToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_next_tasks",
        description:
          "Get a list of all pending tasks based on Taskwarrior's 'next' algorithm. Optional filters for project and tags.",
        inputSchema: zodToJsonSchema(
          ListPendingTasksRequestSchema,
        ) as ToolInput,
      },
      {
        name: "mark_task_done",
        description: "Mark a task as done (completed) using its UUID.",
        inputSchema: zodToJsonSchema(MarkTaskDoneRequestSchema) as ToolInput,
      },
      {
        name: "add_task",
        description:
          "Add a new task with a description and optional properties.",
        inputSchema: zodToJsonSchema(AddTaskRequestSchema) as ToolInput,
      },
      {
        name: "list_tasks",
        description:
          "Get a list of tasks as JSON objects based on flexible filters (status, project, tags, dates, limit, etc.).",
        inputSchema: zodToJsonSchema(ListTasksRequestSchema) as ToolInput,
      },
      {
        name: "get_task_details",
        description:
          "Get detailed information for a specific task by its UUID.",
        inputSchema: zodToJsonSchema(GetTaskDetailsRequestSchema) as ToolInput,
      },
      {
        name: "modify_task",
        description:
          "Modify attributes of an existing task (e.g., description, due, priority, project, tags) by its UUID.",
        inputSchema: zodToJsonSchema(ModifyTaskRequestSchema) as ToolInput,
      },
      {
        name: "start_task",
        description:
          "Mark a task as started by its UUID. If already started, updates the start time.",
        inputSchema: zodToJsonSchema(StartTaskRequestSchema) as ToolInput,
      },
      {
        name: "stop_task",
        description:
          "Stop a task that is currently active (started) by its UUID.",
        inputSchema: zodToJsonSchema(StopTaskRequestSchema) as ToolInput,
      },
      {
        name: "delete_task",
        description: "Delete a task by its UUID. Optionally skip confirmation.",
        inputSchema: zodToJsonSchema(DeleteTaskRequestSchema) as ToolInput,
      },
      {
        name: "add_annotation",
        description:
          "Add an annotation (note) to an existing task by its UUID.",
        inputSchema: zodToJsonSchema(AddAnnotationRequestSchema) as ToolInput,
      },
      {
        name: "remove_annotation",
        description:
          "Remove an existing annotation from a task by its UUID and exact annotation text.",
        inputSchema: zodToJsonSchema(
          RemoveAnnotationRequestSchema,
        ) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: z.infer<typeof CallToolRequestSchema>) => {
    try {
      const { name, arguments: args } = request.params;
      let result: any; // To store result from handler

      switch (name) {
        case "get_next_tasks": {
          const parsedArgs = ListPendingTasksRequestSchema.parse(args);
          result = await handleGetNextTasks(parsedArgs);
          break;
        }
        case "mark_task_done": {
          const parsedArgs = MarkTaskDoneRequestSchema.parse(args);
          result = await markTaskDoneHandler(parsedArgs);
          break;
        }
        case "add_task": {
          const parsedArgs = AddTaskRequestSchema.parse(args);
          result = await handleAddTask(parsedArgs);
          break;
        }
        case "list_tasks": {
          const parsedArgs = ListTasksRequestSchema.parse(args);
          result = await handleListTasks(parsedArgs);
          break;
        }
        case "get_task_details": {
          const parsedArgs = GetTaskDetailsRequestSchema.parse(args);
          result = await getTaskDetailsHandler(parsedArgs);
          break;
        }
        case "modify_task": {
          const parsedArgs = ModifyTaskRequestSchema.parse(args);
          result = await modifyTaskHandler(parsedArgs);
          break;
        }
        case "start_task": {
          const parsedArgs = StartTaskRequestSchema.parse(args);
          result = await startTaskHandler(parsedArgs);
          break;
        }
        case "stop_task": {
          const parsedArgs = StopTaskRequestSchema.parse(args);
          result = await stopTaskHandler(parsedArgs);
          break;
        }
        case "delete_task": {
          const parsedArgs = DeleteTaskRequestSchema.parse(args);
          result = await deleteTaskHandler(parsedArgs);
          break;
        }
        case "add_annotation": {
          const parsedArgs = AddAnnotationRequestSchema.parse(args);
          result = await addAnnotationHandler(parsedArgs);
          break;
        }
        case "remove_annotation": {
          const parsedArgs = RemoveAnnotationRequestSchema.parse(args);
          result = await removeAnnotationHandler(parsedArgs);
          break;
        }
        default: 
          return {
            content: [
              {
                type: "error",
                text: `Tool "${name}" not found.`,
              },
            ],
          };
      }

      // Check if the result from the handler is an error (conforming to ErrorResponseSchema)
      if (result && typeof result === 'object' && 'error' in result && !('content' in result)) {
        return {
          content: [
            {
              type: "error", // Or type: "json" with the error object, depending on client handling
              text: result.error, // Or json: result if type is json
              // Optionally include result.details if present
            },
          ],
        };
      } else if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
        // If the handler already returned a compliant MCP response (e.g. handleAddTask)
        return result;
      } else {
        // Wrap successful results
        return {
          content: [
            {
              type: "json",
              json: result,
            },
          ],
        };
      }

    } catch (error: any) {
      console.error("Error processing CallToolRequest:", error);
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof z.ZodError) {
        errorMessage = `Invalid arguments: ${error.issues.map(i => i.path.join('.') + ': ' + i.message).join(', ')}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        content: [
          {
            type: "error",
            text: errorMessage,
          },
        ],
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // console.error("MCP TaskWarrior Server running on stdio"); // Keep this commented for cleaner output unless debugging
}

runServer().catch((err) => {
  console.error("Server crashed:", err);
  process.exit(1);
});
