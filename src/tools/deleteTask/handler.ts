import {
  DeleteTaskRequestSchema,
  ErrorResponse,
  DeleteTaskResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const deleteTaskHandler = async (
  body: unknown,
): Promise<DeleteTaskResponse | ErrorResponse> => {
  const validationResult = DeleteTaskRequestSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    // For a real API, you'd return a structured error response
    throw new Error("Invalid request body for deleteTask");
  }

  const { uuid, skipConfirmation } = validationResult.data;

  try {
    // First, verify the task exists before attempting to delete
    // This also implicitly validates the UUID format via getTaskByUuid
    await getTaskByUuid(uuid);

    const commandArgs: string[] = [uuid, "delete"];

    if (skipConfirmation) {
      // Taskwarrior uses rc.confirmation=no or rc.confirmation=yes
      // We can also use the --force flag with some commands, but for delete, it's through rc overrides.
      // A common way is to temporarily override the config: task rc.confirmation=no <uuid> delete
      // So, commandArgs should be structured to allow this if execSync handles it, or more directly:
      commandArgs.unshift("rc.confirmation=off"); // Prepend to apply to this command invocation
      // Note: The order might matter, or it might be better as `task <uuid> delete rc.confirmation=off`
      // Let's stick to `task rc.confirmation=off <uuid> delete` for now as it's a common pattern.
      // Update based on testing: `task <uuid> delete rc.confirmation=off` might not work.
      // The `task` command usually takes overrides before the filter/command.
      // So, `task rc.confirmation=no <uuid> delete` is more standard.
      // Let's adjust commandArgs creation: modify the command to include the override.
      // Simpler: executeTaskWarriorCommandRaw can take `task` and then args. If we want to modify `task` itself, it's tricky.
      // Alternative: just add it as an arg. `task <uuid> delete rc.confirmation:off` (using colon for some TW versions)
      // or `task <uuid> delete confirmation:off`.
      // The most reliable is often `task <uuid> delete` and ensure user config allows no-confirm or handle error.
      // For programmatic use, `task rc.confirmation=off <filter> <command>` is better.
      // Let's ensure `executeTaskWarriorCommandRaw` can handle this if `task` is prepended there.
      // Current `executeTaskWarriorCommandRaw` is `task ${commandArgs.join(" "}}`
      // So `commandArgs = ["rc.confirmation=off", uuid, "delete"]` will become `task rc.confirmation=off <uuid> delete`
      // This seems correct. Let's re-evaluate if `unshift` is best or if we should reconstruct.
      // `commandArgs` was `[uuid, "delete"]`. `commandArgs.unshift("rc.confirmation=off")` makes it ["rc.confirmation=off", uuid, "delete"]`.
      // This will result in `task rc.confirmation=off <uuid> delete` which is a valid way to override config for a single command.
    }

    const deleteOutput = executeTaskWarriorCommandRaw(commandArgs);
    console.log("TaskWarrior delete output:", deleteOutput); // For debugging

    // Confirm deletion by trying to fetch it again. Expect an error.
    try {
      await getTaskByUuid(uuid);
      // If getTaskByUuid succeeds, the task was NOT deleted.
      console.error(
        `Task with UUID '${uuid}' was not deleted despite command success.`,
      );
      return {
        error: `Task with UUID '${uuid}' was attempted to be deleted, but it still exists.`,
      } satisfies ErrorResponse;
    } catch (fetchError: unknown) {
      // We expect an error here, specifically a "not found" error.
      // Check if fetchError is an Error instance before accessing message property
      let fetchErrorMessage = "Unknown error during fetch confirmation";
      if (fetchError instanceof Error) {
        fetchErrorMessage = fetchError.message;
      }

      if (fetchErrorMessage.includes("not found")) {
        // This is the expected outcome.
        return {
          message: `Task '${uuid}' deleted successfully.`,
          deletedUuid: uuid,
        } satisfies DeleteTaskResponse;
      } else {
        // An unexpected error occurred while trying to confirm deletion.
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
      // Keep original message as details if it was a confirmation error
      if (
        !skipConfirmation &&
        error.message &&
        error.message.toLowerCase().includes("confirmation")
      ) {
        details = error.message;
        message = `Deletion requires confirmation. Use skipConfirmation:true or ensure your Taskwarrior configuration allows deletion without confirmation.`;
      }
    }
    console.error(`Error in deleteTaskHandler for UUID '${uuid}':`, error);
    // if (!skipConfirmation && error.message && error.message.toLowerCase().includes("confirmation")) {
    //     return {
    //         error: `Deletion requires confirmation. Use skipConfirmation:true or ensure your Taskwarrior configuration allows deletion without confirmation.`,
    //         details: error.message
    //     } satisfies ErrorResponse;
    // }
    return {
      error: message,
      details: details,
    } satisfies ErrorResponse;
  }
};
