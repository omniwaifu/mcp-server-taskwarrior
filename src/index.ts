#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  // ToolSchema as MCPToolSchema, // No longer used
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
  ErrorResponse, // Import ErrorResponse type
  ToolHandlerSuccessResponse, // Import the new union type
} from "./types/task.js";

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
        inputSchema: zodToJsonSchema(ListPendingTasksRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "mark_task_done",
        description: "Mark a task as done (completed) using its UUID.",
        inputSchema: zodToJsonSchema(MarkTaskDoneRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "add_task",
        description:
          "Add a new task with a description and optional properties.",
        inputSchema: zodToJsonSchema(AddTaskRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "list_tasks",
        description:
          "Get a list of tasks as JSON objects based on flexible filters (status, project, tags, dates, limit, etc.).",
        inputSchema: zodToJsonSchema(ListTasksRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "get_task_details",
        description:
          "Get detailed information for a specific task by its UUID.",
        inputSchema: zodToJsonSchema(GetTaskDetailsRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "modify_task",
        description:
          "Modify attributes of an existing task (e.g., description, due, priority, project, tags) by its UUID.",
        inputSchema: zodToJsonSchema(ModifyTaskRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "start_task",
        description:
          "Mark a task as started by its UUID. If already started, updates the start time.",
        inputSchema: zodToJsonSchema(StartTaskRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "stop_task",
        description:
          "Stop a task that is currently active (started) by its UUID.",
        inputSchema: zodToJsonSchema(StopTaskRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "delete_task",
        description: "Delete a task by its UUID. Optionally skip confirmation.",
        inputSchema: zodToJsonSchema(DeleteTaskRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "add_annotation",
        description:
          "Add an annotation (note) to an existing task by its UUID.",
        inputSchema: zodToJsonSchema(AddAnnotationRequestSchema), // Correctly assign JSON schema
      },
      {
        name: "remove_annotation",
        description:
          "Remove an existing annotation from a task by its UUID and exact annotation text.",
        inputSchema: zodToJsonSchema(RemoveAnnotationRequestSchema), // Correctly assign JSON schema
      },
    ],
  };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: z.infer<typeof CallToolRequestSchema>) => {
    try {
      const { name, arguments: args } = request.params;
      // Type result to accommodate direct MCP responses or success/error objects
      let result:
        | ToolHandlerSuccessResponse
        | ErrorResponse
        | { content: any[] }
        | undefined;

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
      if (
        result &&
        typeof result === "object" &&
        "error" in result &&
        !("content" in result)
      ) {
        const errorResult = result as ErrorResponse; // Type assertion
        return {
          content: [
            {
              type: "error",
              text: errorResult.error,
            },
          ],
        };
      } else if (
        result &&
        typeof result === "object" &&
        "content" in result &&
        Array.isArray(result.content)
      ) {
        // If the handler already returned a compliant MCP response (e.g. handleAddTask, handleGetNextTasks)
        return result; // result is already { content: any[] }
      } else if (result) {
        // Wrap successful non-MCP results
        return {
          content: [
            {
              type: "json",
              json: result, // result is ToolHandlerSuccessResponse here
            },
          ],
        };
      } else {
        // Should not happen if handlers always return something or throw
        return {
          content: [
            {
              type: "error",
              text: "Tool executed but returned no result.",
            },
          ],
        };
      }
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
