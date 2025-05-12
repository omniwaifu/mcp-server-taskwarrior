// import { z } from "zod"; // No longer needed here
import type {
  ListPendingTasksRequest,
  TaskWarriorTask,
  ErrorResponse, // Import ErrorResponse
} from "../../types/task.js"; // Import the type
// The Zod schema itself will be used by index.ts for parsing before calling this handler.
// If this handler needed to do its own validation or access the schema, it would import ListPendingTasksRequestSchema
import { executeTaskWarriorCommandJson } from "../../utils/taskwarrior.js";

export async function handleGetNextTasks(
  args: ListPendingTasksRequest,
): Promise<TaskWarriorTask[] | ErrorResponse> {
  // Update return type
  console.log("handleGetNextTasks called with:", args);

  // Taskwarrior's 'next' report implicitly applies urgency and other factors.
  // We can add explicit filters if provided in args.
  const commandArgs = ["next"];
  if (args.project) {
    commandArgs.push(`project:${args.project}`);
  }
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach((tag) => commandArgs.push(`+${tag}`));
  }
  // The 'export' will be added by executeTaskWarriorCommandJson if not implicitly handled by 'next' report (it should be).

  try {
    const pendingTasks = await executeTaskWarriorCommandJson(commandArgs);
    return pendingTasks; // Return TaskWarriorTask[] directly
  } catch (error: unknown) {
    console.error("Error in handleGetNextTasks:", error);
    let message = "Failed to get next tasks.";
    let details: string | undefined;
    if (error instanceof Error) {
      message = error.message;
      details = error.stack; // Capture stack for details
    } else if (typeof error === "string") {
      message = error;
    }
    return {
      error: message, // Conform to ErrorResponse
      details,
    };
  }
}
