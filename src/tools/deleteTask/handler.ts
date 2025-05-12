import type {
  DeleteTaskRequest,
  ErrorResponse,
  DeleteTaskResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const deleteTaskHandler = async (
  args: DeleteTaskRequest,
): Promise<DeleteTaskResponse | ErrorResponse> => {
  // Validation is now done by src/index.ts
  // const validationResult = DeleteTaskRequestSchema.safeParse(body);
  // if (!validationResult.success) { ... }

  const { uuid, skipConfirmation } = args;

  try {
    await getTaskByUuid(uuid);

    const commandArgs: string[] = [uuid, "delete"];

    if (skipConfirmation) {
      commandArgs.unshift("rc.confirmation=off");
    }

    const deleteOutput = executeTaskWarriorCommandRaw(commandArgs);
    console.log("TaskWarrior delete output:", deleteOutput);

    try {
      await getTaskByUuid(uuid);
      console.error(
        `Task with UUID '${uuid}' was not deleted despite command success.`,
      );
      return {
        error: `Task with UUID '${uuid}' was attempted to be deleted, but it still exists.`,
      } satisfies ErrorResponse;
    } catch (fetchError: unknown) {
      let fetchErrorMessage = "Unknown error during fetch confirmation";
      if (fetchError instanceof Error) {
        fetchErrorMessage = fetchError.message;
      }

      if (fetchErrorMessage.includes("not found")) {
        return {
          message: `Task '${uuid}' deleted successfully.`,
          deletedUuid: uuid,
        } satisfies DeleteTaskResponse;
      } else {
        console.error(
          `Unexpected error while confirming deletion of task '${uuid}':`,
          fetchError,
        );
        return {
          error: `Task '${uuid}' deletion status uncertain. Confirmation check failed: ${fetchErrorMessage}`,
        } satisfies ErrorResponse;
      }
    }
  } catch (error: unknown) {
    let message = "Failed to delete task.";
    let details: string | undefined;
    if (error instanceof Error) {
      message = error.message;
      if (
        !skipConfirmation &&
        error.message &&
        error.message.toLowerCase().includes("confirmation")
      ) {
        details = error.message; // Original error message
        message = `Deletion requires confirmation. Use skipConfirmation:true or ensure your Taskwarrior configuration allows deletion without confirmation.`;
      } else {
        details = error.stack; // General error stack
      }
    } else if (typeof error === "string") {
      message = error;
    }
    console.error(`Error in deleteTaskHandler for UUID '${uuid}':`, error);
    return {
      error: message,
      details: details,
    } satisfies ErrorResponse;
  }
};
