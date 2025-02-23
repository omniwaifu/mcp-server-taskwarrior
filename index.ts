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
import os from 'os';
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { diffLines, createTwoFilesPatch } from 'diff';
import { minimatch } from 'minimatch';

import { execSync } from 'child_process';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: mcp-server-taskwarrior <allowed-directory> [additional-directories...]");
  process.exit(1);
}

// Normalize all paths consistently
function normalizePath(p: string): string {
  return path.normalize(p);
}

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// Store allowed directories in normalized form
const allowedDirectories = args.map(dir =>
  normalizePath(path.resolve(expandHome(dir)))
);

// Validate that all directories exist and are accessible
await Promise.all(args.map(async (dir) => {
  try {
    const stats = await fs.stat(dir);
    if (!stats.isDirectory()) {
      console.error(`Error: ${dir} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error accessing directory ${dir}:`, error);
    process.exit(1);
  }
}));

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
  project: z.string().regex(/^[a-z.]+$/).optional(),
  tags: z.array(z.string().regex(/^a-z$/)).optional(),
});

// Request schemas for different operations
const listPendingTasksRequest = z.object({
  project: z.string().regex(/^[a-z.]+$/).optional(),
  tags: z.array(z.string().regex(/^a-z$/)).optional(),
});

const listTasksRequest = z.object({
  status: z.enum(["pending", "completed", "deleted", "waiting", "recurring"]).optional(),
  project: z.string().regex(/^[a-z.]+$/).optional(),
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
  project: z.string().regex(/^[a-z.]+$/).optional(),
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
    ],
  };
});


server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_next_tasks": {
        const parsed = listPendingTasksRequest.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_next_tasks: ${parsed.error}`);
        }
        let task_args = [];
        if (parsed.data.tags) {
          for(let tag of parsed.data.tags) {
            task_args.push(`+${tag}`);
          }
        }
        if (parsed.data.project) {
            task_args.push(`project:${parsed.data.project}`);
        }
        const content = execSync(`task limit: ${task_args.join(" ")} next`, { maxBuffer: 1024 * 1024 * 10 }).toString().trim();
        return {
          content: [{ type: "text", text: content }],
        };
      }

      case "mark_task_done": {
        const parsed = markTaskDoneRequest.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for mark_task_done: ${parsed.error}`);
        }
        const content = execSync(`task ${parsed.data.identifier} done`, { maxBuffer: 1024 * 1024 * 10 }).toString().trim();
        return {
          content: [{ type: "text", text: content }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP TaskWarrior Server running on stdio");
  console.error("Allowed directories:", allowedDirectories);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
