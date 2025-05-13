#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  // ToolSchema as MCPToolSchema, // No longer used
} from "@modelcontextprotocol/sdk/types.js";
// fs, path, os, diffLines, createTwoFilesPatch, minimatch might not be needed here anymore
// import fs from "fs/promises";
// import path from "path";
// import os from "os";
import { z } from "zod";
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
  ErrorResponse, // Import ErrorResponse type
  ToolHandlerSuccessResponse, // Import the new union type
} from "./types/task.js";

// Import response formatter utilities
import { createMcpSuccessResponse, createMcpErrorResponse } from "./utils/mcpResponseFormat.js";

// Pre-generate JSON schemas for tool inputs
const listPendingTasksJsonSchema = {
  type: "object",
  properties: {
    project: {
      type: "string",
      pattern: "^[a-zA-Z0-9 ._-]+$",
    },
    tags: {
      type: "array",
      items: {
        type: "string",
        pattern: "^[a-zA-Z0-9_-]+$",
      },
    },
  },
  additionalProperties: false,
} as const; // Use 'as const' for stronger typing of the literal

const markTaskDoneJsonSchema = {
  type: "object",
  properties: {
    uuid: {
      type: "string",
      format: "uuid", // JSON schema format for UUID
    },
  },
  required: ["uuid"],
  additionalProperties: false,
} as const;

const addTaskJsonSchema = {
  type: "object",
  properties: {
    description: { type: "string" },
    due: { type: "string" }, // Based on z.string().optional()
    priority: { type: "string", enum: ["H", "M", "L"] },
    project: { type: "string", pattern: "^[a-zA-Z0-9 ._-]+$" },
    tags: {
      type: "array",
      items: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
    },
  },
  required: ["description"],
  additionalProperties: false,
} as const;

const listTasksJsonSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["pending", "completed", "deleted", "waiting", "recurring"],
    },
    project: { type: "string", pattern: "^[a-zA-Z0-9 ._-]+$" },
    tags: {
      type: "array",
      items: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
    },
    descriptionContains: { type: "string" },
    dueBefore: { type: "string", format: "date-time" },
    dueAfter: { type: "string", format: "date-time" },
    scheduledBefore: { type: "string", format: "date-time" },
    scheduledAfter: { type: "string", format: "date-time" },
    modifiedBefore: { type: "string", format: "date-time" },
    modifiedAfter: { type: "string", format: "date-time" },
    limit: { type: "integer" },
  },
  additionalProperties: false,
} as const;

const getTaskDetailsJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
  },
  required: ["uuid"],
  additionalProperties: false,
} as const;

const modifyTaskJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["pending", "completed", "deleted", "waiting", "recurring"],
    },
    due: { type: "string", format: "date-time" },
    priority: { type: "string", enum: ["H", "M", "L"] },
    project: { type: "string", pattern: "^[a-zA-Z0-9 ._-]*$" },
    addTags: {
      type: "array",
      items: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
    },
    removeTags: {
      type: "array",
      items: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
    },
  },
  required: ["uuid"],
  additionalProperties: false,
} as const;

const startTaskJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
  },
  required: ["uuid"],
  additionalProperties: false,
} as const;

const stopTaskJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
  },
  required: ["uuid"],
  additionalProperties: false,
} as const;

const deleteTaskJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
    skipConfirmation: { type: "boolean" },
  },
  required: ["uuid"],
  additionalProperties: false,
} as const;

const addAnnotationJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
    annotation: { type: "string" },
  },
  required: ["uuid", "annotation"],
  additionalProperties: false,
} as const;

const removeAnnotationJsonSchema = {
  type: "object",
  properties: {
    uuid: { type: "string", format: "uuid" },
    annotation: { type: "string" },
  },
  required: ["uuid", "annotation"],
  additionalProperties: false,
} as const;

// Define a local schema that we expect for tool calls via this server
const LocalCallToolRequestSchema = z
  .object({
    jsonrpc: z.literal("2.0").optional(), // Standard JSON-RPC field, often present
    method: z.literal("tools/call"), // Crucial: MCP method for tool calls
    id: z.union([z.string(), z.number(), z.null()]).optional(), // Standard JSON-RPC field, often present
    params: z.object({
      name: z.string(), // Name of the tool to call
      arguments: z.record(z.string(), z.unknown()).optional(), // Tool arguments
      _meta: z
        .object({
          // Optional metadata
          progressToken: z.union([z.string(), z.number()]).optional(),
        })
        .optional(),
    }),
  })
  .passthrough(); // Allow other fields that might be part of the SDK's schema

export type InferredLocalCallToolRequest = z.infer<
  typeof LocalCallToolRequestSchema
>;

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
// const ToolInputSchema = MCPToolSchema.shape.inputSchema; // Unused, and potentially misused
// type ToolInput = z.infer<typeof ToolInputSchema>; // Unused type

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_next_tasks",
        description:
          "Get a list of all pending tasks based on Taskwarrior's 'next' algorithm. Optional filters for project and tags.",
        inputSchema: listPendingTasksJsonSchema,
      },
      {
        name: "mark_task_done",
        description: "Mark a task as done (completed) using its UUID.",
        inputSchema: markTaskDoneJsonSchema,
      },
      {
        name: "add_task",
        description:
          "Add a new task with a description and optional properties.",
        inputSchema: addTaskJsonSchema,
      },
      {
        name: "list_tasks",
        description:
          "Get a list of tasks as JSON objects based on flexible filters (status, project, tags, dates, limit, etc.).",
        inputSchema: listTasksJsonSchema,
      },
      {
        name: "get_task_details",
        description:
          "Get detailed information for a specific task by its UUID.",
        inputSchema: getTaskDetailsJsonSchema,
      },
      {
        name: "modify_task",
        description:
          "Modify attributes of an existing task (e.g., description, due, priority, project, tags) by its UUID.",
        inputSchema: modifyTaskJsonSchema,
      },
      {
        name: "start_task",
        description:
          "Mark a task as started by its UUID. If already started, updates the start time.",
        inputSchema: startTaskJsonSchema,
      },
      {
        name: "stop_task",
        description:
          "Stop a task that is currently active (started) by its UUID.",
        inputSchema: stopTaskJsonSchema,
      },
      {
        name: "delete_task",
        description: "Delete a task by its UUID. Optionally skip confirmation.",
        inputSchema: deleteTaskJsonSchema,
      },
      {
        name: "add_annotation",
        description:
          "Add an annotation (note) to an existing task by its UUID.",
        inputSchema: addAnnotationJsonSchema,
      },
      {
        name: "remove_annotation",
        description:
          "Remove an existing annotation from a task by its UUID and exact annotation text.",
        inputSchema: removeAnnotationJsonSchema,
      },
    ],
  };
});

server.setRequestHandler(
  LocalCallToolRequestSchema as any, // Cast to any as a workaround for _cached issue
  async (request: InferredLocalCallToolRequest) => {
    // Use the inferred type from local schema
    try {
      const { name, arguments: args } = request.params;
      let result: unknown;

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
          return createMcpErrorResponse(`Tool "${name}" not found.`);
      }

      // Handle results coming from our handlers
      if (result && typeof result === "object") {
        // Handle our custom McpToolResponse format (for backward compatibility)
        if ("status" in result && "tool_name" in result) {
          const mcpResult = result as any;
          
          if (mcpResult.status === "error" && mcpResult.error) {
            return createMcpErrorResponse(mcpResult.error.message || "Unknown error");
          } 
          
          if (mcpResult.result?.content?.[0]?.type === "json" && mcpResult.result.content[0].data) {
            // Extract the data from our custom format
            return createMcpSuccessResponse(mcpResult.result.content[0].data);
          }
        }
        
        // Handle native error objects
        if ("error" in result) {
          const errorResult = result as ErrorResponse;
          return createMcpErrorResponse(errorResult.error);
        }
      }
      
      // Default case - return whatever we got
      return createMcpSuccessResponse(result);
    } catch (error: unknown) {
      console.error("Error processing CallToolRequest:", error);
      let errorMessage = "An unexpected error occurred.";
      
      if (error instanceof z.ZodError) {
        errorMessage = `Invalid arguments: ${error.issues.map((i) => i.path.join(".") + ": " + i.message).join(", ")}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      
      return createMcpErrorResponse(errorMessage);
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP TaskWarrior Server running on stdio"); // Keep this commented for cleaner output unless debugging
}

runServer().catch((err) => {
  console.error("Server crashed:", err);
  process.exit(1);
});
