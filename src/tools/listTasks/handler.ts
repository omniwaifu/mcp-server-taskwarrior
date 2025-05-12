import type {
  ListTasksRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import { executeTaskWarriorCommandJson } from "../../utils/taskwarrior.js";

// Define standard MCP ContentItem types if not already available globally
// For simplicity, defining inline; ideally, these come from an MCP SDK package
interface JsonContentItem {
  type: "json";
  data: any;
}

interface TextContentItem {
  type: "text";
  text: string;
}

// Define a standard MCP ToolResponse structure
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

export async function handleListTasks(
  args: ListTasksRequest,
  toolName: string = "listTasks", // MCP Router usually provides this
): Promise<McpToolResponse> { // Return type is now McpToolResponse
  const filters: string[] = [];

  if (args.project) {
    filters.push(`project:${args.project}`);
  }
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach((tag) => filters.push(`+${tag}`));
  }
  if (args.status) {
    filters.push(`status:${args.status}`);
  }
  if (args.descriptionContains) {
    filters.push(`description.contains:${args.descriptionContains}`);
  }
  if (args.dueBefore) {
    filters.push(`due.before:${args.dueBefore}`);
  }
  if (args.dueAfter) {
    filters.push(`due.after:${args.dueAfter}`);
  }
  if (args.scheduledBefore) {
    filters.push(`scheduled.before:${args.scheduledBefore}`);
  }
  if (args.scheduledAfter) {
    filters.push(`scheduled.after:${args.scheduledAfter}`);
  }
  if (args.modifiedBefore) {
    filters.push(`modified.before:${args.modifiedBefore}`);
  }
  if (args.modifiedAfter) {
    filters.push(`modified.after:${args.modifiedAfter}`);
  }
  if (args.limit) {
    filters.push(`limit:${args.limit}`);
  }

  // Always add export unless it's already there implicitly via a report name
  // executeTaskWarriorCommandJson handles adding "export" if not present.
  if (!filters.some(arg => arg.toLowerCase().includes('export'))) {
    filters.push("export");
  }

  try {
    const tasksArray = await executeTaskWarriorCommandJson(filters);
    
    // tasksArray will be [] if no matches, thanks to executeTaskWarriorCommandJson
    // Always use the standard success response format
    return {
      tool_name: toolName,
      status: "success",
      result: {
        content: [
          {
            type: "json",
            data: tasksArray, // Send the array (empty or populated)
          },
        ],
      },
    };
  } catch (error: unknown) {
    console.error(`Error in ${toolName} handler:`, error);
    let message = `Failed to execute ${toolName}.`;
    let errorCode = "TOOL_EXECUTION_ERROR";
    let details: string | undefined;

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

    // For actual errors, return the standard error structure
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
