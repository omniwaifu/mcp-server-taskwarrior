import type {
  StopTaskRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const stopTaskHandler = async (
  args: StopTaskRequest,
): Promise<TaskWarriorTask | ErrorResponse> => {
  const { uuid } = args;

  try {
    const taskToStop = await getTaskByUuid(uuid);
    if (!taskToStop) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot stop.`,
      };
    }

    if (!taskToStop.start) {
      console.log(
        `Task '${uuid}' is not started. Stop command will be a no-op.`,
      );
    }

    executeTaskWarriorCommandRaw([uuid, "stop"]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' was stopped, but could not be retrieved afterwards.`,
        details:
          "The task modification command seemed to succeed but the task vanished.",
      };
    }
    if (updatedTask.start) {
      console.warn(
        `Task '${uuid}' still has a start time after stop command. Current status: ${updatedTask.status}`,
      );
    }

    return updatedTask;
  } catch (error: unknown) {
    console.error("Error in stopTaskHandler:", error);
    let message = "Failed to stop task.";
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
