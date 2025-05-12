import { z } from "zod";
import {
  StartTaskRequestSchema,
  TaskWarriorTaskSchema,
  ErrorResponseSchema,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const startTaskHandler = async (
  body: unknown,
): Promise<
  z.infer<typeof TaskWarriorTaskSchema> | z.infer<typeof ErrorResponseSchema>
> => {
  const validationResult = StartTaskRequestSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    return {
      error: "Invalid request body for startTask",
      details: validationResult.error.toString(),
    };
  }

  const { uuid } = validationResult.data;

  try {
    const taskToStart = await getTaskByUuid(uuid);
    if (!taskToStart) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot start.`,
      };
    }

    // Check if task is already started (Taskwarrior 'start' is idempotent but good to know)
    // A task is active if it has a 'start' timestamp and no 'end' timestamp (though 'end' isn't usually on active tasks).
    // Taskwarrior manages this internally. If `task <uuid> start` is run on an already started task, it doesn't error.
    // It might output "Task ... already started."
    if (taskToStart.start) {
      console.log(
        `Task '${uuid}' is already started (start date: ${taskToStart.start}). Re-starting might occur or be a no-op.`,
      );
      // We can choose to proceed or return the task as is.
      // Forcing a re-start via TaskWarrior might update the start time if hooks/config allow.
      // Let's proceed, as \`task start\` itself is idempotent or updates.
    }

    executeTaskWarriorCommandRaw([uuid, "start"]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' was started, but could not be retrieved afterwards.`,
      };
    }
    if (!updatedTask.start) {
      // This would be unexpected if the start command was successful.
      return {
        error: `Task with UUID '${uuid}' was attempted to be started, but it does not have a start time.`,
      };
    }

    return updatedTask;
  } catch (error: unknown) {
    console.error("Error in startTaskHandler:", error);
    let message = "Failed to start task.";
    if (error instanceof Error) {
      message = error.message;
    }
    return { error: message };
  }
};
 