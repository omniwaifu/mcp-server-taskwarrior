import { z } from "zod";
import {
  AddAnnotationRequestSchema,
  AddAnnotationResponseSchema,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const addAnnotationHandler = async (
  body: unknown,
): Promise<z.infer<typeof AddAnnotationResponseSchema>> => {
  const validationResult = AddAnnotationRequestSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    throw new Error("Invalid request body for addAnnotation");
  }

  const { uuid, annotation } = validationResult.data;

  try {
    // First, ensure the task exists
    /*const taskToAnnotate =*/ await getTaskByUuid(uuid); // Variable not used, just ensure task exists

    // TaskWarrior expects annotations to be shell-quoted if they contain spaces or special characters.
    // The executeTaskWarriorCommandRaw function handles individual argument quoting,
    // but complex strings might still need careful handling or direct shell execution if features like `task rc.shell.prompt=no ...` were used.
    // For annotations, taskwarrior CLI handles the quoting internally if the annotation text is passed as a single argument like `task <uuid> annotate 'My annotation text'`
    // We need to ensure our executeTaskWarriorCommandRaw or the calling logic correctly forms the command arguments.
    // The current executeTaskWarriorCommandRaw splits by space and quotes, which is fine for simple commands but might break for complex annotation text passed as multiple arguments.
    // Let's assume taskwarrior handles `annotate 'text'` correctly as a single argument via execa.

    // Construct the command arguments for adding an annotation.
    // Example: task <uuid> annotate "This is a multi-word annotation"
    // We will pass the annotation text as a single argument to `executeTaskWarriorCommandRaw`
    // which should then be properly handled by `execa` if it needs quoting for the shell.
    // The `task` command itself will interpret the final argument as the annotation string.

    // Ensure the annotation text is treated as a single argument by `task`
    // We pass `uuid, 'modify', \`annotate:\${annotation}\`
    // Correction: The command is `task <filter> annotate <text>`
    await executeTaskWarriorCommandRaw([
      uuid,
      "annotate",
      `'${annotation.replace(/'/g, `'\''`)}'`, // Shell escape the annotation
    ]);

    // Fetch the updated task to confirm the annotation and return it
    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      // This should not happen if the above commands succeeded
      throw new Error("Failed to fetch task after adding annotation.");
    }

    return {
      task: updatedTask,
    };
  } catch (error) {
    console.error("Error in addAnnotationHandler:", error);
    throw error;
  }
};
 