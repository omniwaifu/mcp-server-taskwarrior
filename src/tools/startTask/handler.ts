import type {
  StartTaskRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const startTaskHandler = async (
  args: StartTaskRequest,
): Promise<TaskWarriorTask | ErrorResponse> => {
  const { uuid } = args;

  try {
    const taskToStart = await getTaskByUuid(uuid);
    if (!taskToStart) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot start.`,
      };
    }

    if (taskToStart.start) {
      console.log(
        `Task '${uuid}' is already started (start date: ${taskToStart.start}). Re-starting might occur or be a no-op.`,
      );
    }

    executeTaskWarriorCommandRaw([uuid, "start"]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' was started, but could not be retrieved afterwards.`,
        details:
          "The task modification command seemed to succeed but the task vanished.",
      };
    }
    if (!updatedTask.start) {
      return {
        error: `Task with UUID '${uuid}' was attempted to be started, but it does not have a start time.`,
        details:
          "The start command might have failed silently or Taskwarrior state is inconsistent.",
      };
    }

    return updatedTask;
  } catch (error: unknown) {
    console.error("Error in startTaskHandler:", error);
    let message = "Failed to start task.";
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
