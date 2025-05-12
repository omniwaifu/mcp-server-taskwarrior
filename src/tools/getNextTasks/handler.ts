// import { z } from "zod"; // No longer needed here
import type {
  ListPendingTasksRequest,
  TaskWarriorTask,
  ErrorResponse, // Import ErrorResponse
} from "../../types/task.js"; // Import the type
// The Zod schema itself will be used by index.ts for parsing before calling this handler.
// If this handler needed to do its own validation or access the schema, it would import ListPendingTasksRequestSchema
import { executeTaskWarriorCommandJson } from "../../utils/taskwarrior.js";

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

export async function handleGetNextTasks(
  args: ListPendingTasksRequest,
  toolName: string = "getNextTasks", // MCP Router usually provides this
): Promise<McpToolResponse> {
  console.log(`${toolName} called with:`, args);

  // Taskwarrior's 'next' report implicitly applies urgency and other factors.
  // We can add explicit filters if provided in args.
  const commandArgs = ["next"]; // The 'next' report handles filtering for pending/waiting by default.
  
  if (args.project) {
    commandArgs.push(`project:${args.project}`);
  }
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach((tag) => commandArgs.push(`+${tag}`));
  }
  
  // Ensure 'export' is added if not already present
  if (!commandArgs.some(arg => arg.toLowerCase().includes('export'))) {
    commandArgs.push("export");
  }

  try {
    const pendingTasksArray = await executeTaskWarriorCommandJson(commandArgs);
    // pendingTasksArray will be [] if no matches, thanks to executeTaskWarriorCommandJson

    return {
      tool_name: toolName,
      status: "success",
      result: {
        content: [
          {
            type: "json",
            data: pendingTasksArray, // Send the array (empty or populated)
          },
        ],
      },
    };
  } catch (error: unknown) {
    console.error(`Error in ${toolName} handler:`, error);
    let message = `Failed to execute ${toolName}.`;
    let details: string | undefined;
    let errorCode = "TOOL_EXECUTION_ERROR";

    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
      
      // Check for "No matches" pattern in the error message
      if (message.includes("No matches") || message.includes("No tasks found")) {
        console.log(`${toolName}: Found "No matches" type message in error, returning empty array as success.`);
        // For this specific case, return an empty array as a success
        return {
          tool_name: toolName,
          status: "success",
          result: {
            content: [
              {
                type: "json",
                data: [], // Return empty array for "No matches"
              },
            ],
          },
        };
      }
    } else if (typeof error === "string") {
      message = error;
      
      // Check for "No matches" pattern in string error
      if (message.includes("No matches") || message.includes("No tasks found")) {
        console.log(`${toolName}: Found "No matches" string error, returning empty array as success.`);
        // For this specific case, return an empty array as a success
        return {
          tool_name: toolName,
          status: "success",
          result: {
            content: [
              {
                type: "json",
                data: [], // Return empty array for "No matches"
              },
            ],
          },
        };
      }
    }

    return {
      tool_name: toolName,
      status: "error",
      error: {
        code: errorCode,
        message: message,
        details: details,
      },
      result: { // Optionally, provide a text error in content as well
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
