import type {
  GetTaskDetailsRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import { getTaskByUuid } from "../../utils/taskwarrior.js";

export const getTaskDetailsHandler = async (
  args: GetTaskDetailsRequest,
): Promise<TaskWarriorTask | ErrorResponse> => {
  const { uuid } = args;

  try {
    const task = await getTaskByUuid(uuid);
    if (!task) {
      return {
        error: `Task with UUID '${uuid}' not found.`,
      };
    }
    return task;
  } catch (error: unknown) {
    console.error("Error in getTaskDetailsHandler:", error);
    let message = "Failed to get task details.";
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
