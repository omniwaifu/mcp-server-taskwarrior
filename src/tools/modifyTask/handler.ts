import type {
  ModifyTaskRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const modifyTaskHandler = async (
  args: ModifyTaskRequest,
): Promise<TaskWarriorTask | ErrorResponse> => {
  // Validation is now done by src/index.ts
  // const validationResult = ModifyTaskRequestSchema.safeParse(body);
  // if (!validationResult.success) { ... }

  const { uuid, ...modifications } = args;

  try {
    const existingTask = await getTaskByUuid(uuid);
    if (!existingTask) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot modify.`,
      };
    }

    const commandArgs: string[] = [uuid, "modify"];

    // Iterate over the modifications and add them to the command arguments
    if (modifications.description) {
      commandArgs.push(`description:"${modifications.description}"`);
    }
    if (modifications.status) {
      // Note: `task modify status:completed` might not work like `task <uuid> done`.
      // Taskwarrior often prefers specific commands for status changes (done, start, stop).
      // However, `modify status:pending` or `status:waiting` should be fine.
      // For simplicity, we allow it, but be aware of Taskwarrior's behavior.
      commandArgs.push(`status:${modifications.status}`);
    }
    if (modifications.due) {
      commandArgs.push(`due:${modifications.due}`);
    }
    if (modifications.priority) {
      commandArgs.push(`priority:${modifications.priority}`);
    }
    if (modifications.project !== undefined) {
      // Check for undefined to allow setting empty project
      commandArgs.push(`project:${modifications.project}`);
    }
    if (modifications.addTags && modifications.addTags.length > 0) {
      modifications.addTags.forEach((tag) => commandArgs.push(`+${tag}`));
    }
    if (modifications.removeTags && modifications.removeTags.length > 0) {
      modifications.removeTags.forEach((tag) => commandArgs.push(`-${tag}`));
    }

    // If no actual modifications were provided beyond UUID, this check can be useful.
    // However, ModifyTaskRequestSchema should ideally enforce at least one modifiable field if UUID is present.
    if (commandArgs.length === 2) {
      // Only [uuid, "modify"]
      console.warn(
        "modifyTaskHandler called with UUID but no modifications provided.",
      );
      return existingTask; // Return existing task if no modifications were applied
    }

    executeTaskWarriorCommandRaw(commandArgs);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' was modified, but could not be retrieved afterwards.`,
        details:
          "The task modification command seemed to succeed but the task vanished.",
      };
    }

    return updatedTask; // Return TaskWarriorTask directly
  } catch (error: unknown) {
    console.error("Error in modifyTaskHandler:", error);
    let message = "Failed to modify task.";
    let details: string | undefined;
    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === "string") {
      message = error;
    }
    return { error: message, details }; // Conform to ErrorResponse
  }
};
