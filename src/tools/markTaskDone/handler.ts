import type {
  MarkTaskDoneRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";
// isValidUuid and getIdentifierType might be useful if we need to distinguish,
// but getTaskByIdOrUuid should handle both directly for fetching.
// import { isValidUuid, getIdentifierType } from "../../utils/uuid.js";

export const markTaskDoneHandler = async (
  args: MarkTaskDoneRequest,
): Promise<TaskWarriorTask | ErrorResponse> => {
  // Validation is now done by src/index.ts
  // const validationResult = MarkTaskDoneRequestSchema.safeParse(body);
  // if (!validationResult.success) { ... }

  const { uuid } = args;

  try {
    const taskToMark = await getTaskByUuid(uuid);
    if (!taskToMark) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot mark as done.`,
      };
    }

    if (taskToMark.status === "completed") {
      console.log(`Task '${uuid}' is already completed.`);
      return taskToMark;
    }

    executeTaskWarriorCommandRaw([uuid, "done"]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' was marked done, but could not be retrieved afterwards.`,
        details:
          "The task modification command seemed to succeed but the task vanished.",
      };
    }
    if (updatedTask.status !== "completed") {
      console.warn(
        `Task '${uuid}' status is '${updatedTask.status}' after marking done.`,
      );
      return {
        error: `Task with UUID '${uuid}' was attempted to be marked done, but its status is still '${updatedTask.status}'.`,
        details:
          "This might indicate an issue with Taskwarrior hooks or a race condition.",
      };
    }

    return updatedTask;
  } catch (error: unknown) {
    console.error("Error in markTaskDoneHandler:", error);
    let message = "Failed to mark task as done.";
    let details: string | undefined;
    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === "string") {
      message = error;
    }
    return { error: message, details };
  }
};
