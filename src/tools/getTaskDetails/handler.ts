import type {
  GetTaskDetailsRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import { getTaskByUuid } from "../../utils/taskwarrior.js";

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

export const getTaskDetailsHandler = async (
  args: GetTaskDetailsRequest,
  toolName: string = "getTaskDetails", // MCP Router usually provides this
): Promise<McpToolResponse> => {
  const { uuid } = args;

  try {
    const task = await getTaskByUuid(uuid); // getTaskByUuid throws if not found
    
    // If getTaskByUuid resolves, the task was found.
    return {
      tool_name: toolName,
      status: "success",
      result: {
        content: [
          {
            type: "json",
            data: task, // Return the single task object
          },
        ],
      },
    };
  } catch (error: unknown) {
    console.error(`Error in ${toolName} handler for UUID '${uuid}':`, error);
    let message = `Failed to execute ${toolName}.`;
    let details: string | undefined;
    let errorCode = "TOOL_EXECUTION_ERROR";

    if (error instanceof Error) {
      message = error.message;
      if (message.toLowerCase().includes("not found")) {
        errorCode = "TASK_NOT_FOUND";
      }
      details = error.stack;
    } else if (typeof error === "string") {
      message = error;
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
            text: `Error in ${toolName} for UUID '${uuid}': ${message}`,
          },
        ],
      },
    };
  }
};
