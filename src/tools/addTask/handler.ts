// import { z } from "zod";
import type {
  AddTaskRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  executeTaskWarriorCommandJson,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

// --- Standard MCP Interfaces (should ideally be imported) ---
interface JsonContentItem {
  type: "json";
  data: any;
}

interface TextContentItem {
  type: "text";
  text: string;
}

interface McpToolResponse {
  tool_name: string;
  status: "success" | "error";
  result?: {
    content: Array<JsonContentItem | TextContentItem>;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
// --- End MCP Interfaces ---

export async function handleAddTask(
  args: AddTaskRequest,
  toolName: string = "addTask", // MCP Router usually provides this
): Promise<McpToolResponse> {
  console.log(`${toolName} called with:`, args);

  const commandArgs: string[] = ["add"];
  // Ensure description is quoted and internal quotes escaped for the shell command
  commandArgs.push(`'${args.description.replace(/'/g, "'\\''")}'`);

  if (args.due) commandArgs.push(`due:${args.due}`);
  if (args.priority) commandArgs.push(`priority:${args.priority}`);
  if (args.project) commandArgs.push(`project:${args.project}`);
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach((tag) => commandArgs.push(`+${tag}`));
  }

  try {
    const addOutput = executeTaskWarriorCommandRaw(commandArgs);
    console.log("TaskWarrior add output:", addOutput);

    let createdTaskUuid: string | undefined;
    const idMatch = addOutput.match(/Created task (\d+)/i); // Made case-insensitive for safety
    const newUuidMatch = addOutput.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);

    if (newUuidMatch && newUuidMatch[1]) {
      createdTaskUuid = newUuidMatch[1];
      console.log(`Extracted new task UUID directly from output: ${createdTaskUuid}`);
    } else if (idMatch && idMatch[1]) {
      const newTaskId = idMatch[1];
      console.log(`Extracted new task ID from output: ${newTaskId}. Fetching details...`);
      const newlyAddedTasks = await executeTaskWarriorCommandJson([
        newTaskId,
        "export",
      ]);
      if (newlyAddedTasks.length > 0 && newlyAddedTasks[0].uuid) {
        createdTaskUuid = newlyAddedTasks[0].uuid;
      } else {
        console.warn(`Could not get UUID for task ID ${newTaskId} after creation.`);
      }
    }

    if (!createdTaskUuid) {
      // Last resort: try to find by exact description (less reliable)
      console.warn(
        "Could not parse new task ID or UUID from 'add' output. Falling back to description match.",
      );
      // Using single quotes for description in the command, and escaping internal single quotes
      const descriptionForSearch = args.description.replace(/'/g, "'\\''");
      const newTasks = await executeTaskWarriorCommandJson([
        `description:'${descriptionForSearch}'`, // Ensure description is quoted and escaped
        "limit:1",
        "export",
      ]);
      if (newTasks.length > 0 && newTasks[0].uuid) {
        createdTaskUuid = newTasks[0].uuid;
      } else {
         return {
          tool_name: toolName,
          status: "error",
          error: {
            code: "TASK_CREATION_UUID_FAILURE",
            message: "Failed to determine UUID of the newly created task.",
            details: "Task might have been added, but its UUID could not be retrieved. TaskWarrior output: " + addOutput,
          },
           result: {
            content: [
              { type: "text", text: "Failed to determine UUID of the newly created task. TaskWarrior output: " + addOutput },
            ],
          },
        };
      }
    }

    const createdTask = await getTaskByUuid(createdTaskUuid); // getTaskByUuid already handles not found by throwing

    return {
      tool_name: toolName,
      status: "success",
      result: {
        content: [
          {
            type: "json",
            data: [createdTask], // Return the single created task in an array, as per original Promise<TaskWarriorTask[]>
          },
        ],
      },
    };
  } catch (error: unknown) {
    console.error(`Error in ${toolName} handler:`, error);
    let message = `Failed to execute ${toolName}.`;
    let details: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === "string") {
      message = error;
    }

    return {
      tool_name: toolName,
      status: "error",
      error: {
        code: "TOOL_EXECUTION_ERROR",
        message: message,
        details: details,
      },
      result: {
        content: [
          {
            type: "text",
            text: `Error in ${toolName}: ${message}`,
          },
        ],
      },
    };
  }
}
