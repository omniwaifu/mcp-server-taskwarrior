import { z } from "zod";
import {
  StopTaskRequestSchema,
  TaskWarriorTaskSchema,
  ErrorResponseSchema,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const stopTaskHandler = async (
  body: unknown,
): Promise<
  z.infer<typeof TaskWarriorTaskSchema> | z.infer<typeof ErrorResponseSchema>
> => {
  const validationResult = StopTaskRequestSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    return {
      error: "Invalid request body for stopTask",
      details: validationResult.error.toString(),
    };
  }

  const { uuid } = validationResult.data;

  try {
    const taskToStop = await getTaskByUuid(uuid);
    if (!taskToStop) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot stop.`,
      };
    }

    // Check if task is actually started (has a 'start' field and no 'end')
    // Taskwarrior 'stop' on a not-started task is a no-op and doesn't error.
    // It might output "Task ... not active."
    if (!taskToStop.start) {
      console.log(
        `Task '${uuid}' is not started. Stop command will be a no-op.`,
      );
      // We can return the task as is, or proceed and let Taskwarrior handle it.
      // Let's proceed to mimic CLI behavior.
    }

    executeTaskWarriorCommandRaw([uuid, "stop"]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' was stopped, but could not be retrieved afterwards.`,
      };
    }
    // After stopping, the 'start' field might be removed by Taskwarrior, or an 'end' field added,
    // depending on its internal logic for completed vs. merely stopped tasks.
    // The `TaskWarriorTaskSchema` has `start` as optional.
    // If it was pending and then started & stopped, it should return to pending and `start` may be gone.
    // For now, we just return the task. Further checks could be added if specific state is expected.
    if (updatedTask.start) {
      console.warn(
        `Task '${uuid}' still has a start time after stop command. Current status: ${updatedTask.status}`,
      );
    }

    return { task: updatedTask! };
  } catch (error: unknown) {
    console.error("Error in stopTaskHandler:", error);
    let message = "Failed to stop task.";
    if (error instanceof Error) {
      message = error.message;
    }
    return { error: message };
  }
};
 