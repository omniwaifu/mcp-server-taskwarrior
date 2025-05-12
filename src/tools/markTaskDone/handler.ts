import { z } from "zod";
import {
  MarkTaskDoneRequestSchema,
  TaskWarriorTaskSchema,
  ErrorResponseSchema,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";
// isValidUuid and getIdentifierType might be useful if we need to distinguish,
// but getTaskByIdOrUuid should handle both directly for fetching.
// import { isValidUuid, getIdentifierType } from "../../utils/uuid.js";

export const markTaskDoneHandler = async (
  body: unknown,
): Promise<
  z.infer<typeof TaskWarriorTaskSchema> | z.infer<typeof ErrorResponseSchema>
> => {
  const validationResult = MarkTaskDoneRequestSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    return {
      error: "Invalid request body for markTaskDone",
      details: validationResult.error.toString(),
    };
  }

  const { uuid } = validationResult.data;

  try {
    // First, verify the task exists
    const taskToMark = await getTaskByUuid(uuid);
    if (!taskToMark) {
      // Should be caught by getTaskByUuid if it throws an error on not found
      return {
        error: `Task with UUID '${uuid}' not found. Cannot mark as done.`,
      };
    }

    // Check if the task is already done
    if (taskToMark.status === "completed") {
      // Consider if this should be an error or just return the task as is.
      // For idempotency, returning the task might be preferable.
      console.log(`Task '${uuid}' is already completed.`);
      return taskToMark;
    }

    // Execute the command to mark the task as done
    executeTaskWarriorCommandRaw([uuid, "done"]);

    // Fetch the updated task to confirm the change and return it
    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      // This is unexpected if the command succeeded
      return {
        error: `Task with UUID '${uuid}' was marked done, but could not be retrieved afterwards.`,
      };
    }
    if (updatedTask.status !== "completed") {
      console.warn(
        `Task '${uuid}' status is '${updatedTask.status}' after marking done.`,
      );
      // This could indicate an issue with Taskwarrior hooks or a race condition.
      return {
        error: `Task with UUID '${uuid}' was attempted to be marked done, but its status is still '${updatedTask.status}'.`,
      };
    }

    return { task: updatedTask! }; // Use non-null assertion as existence and update are implied
  } catch (error: unknown) {
    console.error("Error in markTaskDoneHandler:", error);
    let message = "Failed to mark task as done.";
    if (error instanceof Error) {
      message = error.message;
    }
    return { error: message };
  }
};
 