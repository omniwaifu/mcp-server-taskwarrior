import { z } from "zod";
import {
  RemoveAnnotationRequestSchema,
  TaskWarriorTaskSchema,
  ErrorResponseSchema,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const removeAnnotationHandler = async (
  body: unknown,
): Promise<
  z.infer<typeof TaskWarriorTaskSchema> | z.infer<typeof ErrorResponseSchema>
> => {
  const validationResult = RemoveAnnotationRequestSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    return {
      error: "Invalid request body for removeAnnotation",
      details: validationResult.error.toString(),
    };
  }

  const { uuid, annotation } = validationResult.data;

  try {
    // First, verify the task exists
    const taskToModify = await getTaskByUuid(uuid);
    if (!taskToModify) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot remove annotation.`,
      };
    }

    // Check if the annotation actually exists on the task
    const existingAnnotation = taskToModify.annotations?.find(
      (a) => a.description === annotation,
    );

    if (!existingAnnotation) {
      return {
        error: `Annotation "${annotation}" not found on task '${uuid}'.`,
        // Optionally return the task as is, or make this a non-error response
      };
      // Alternatively, one could proceed and let Taskwarrior handle it,
      // but it might be better to give a clear error if we can detect it upfront.
      // Taskwarrior's `denotate` command might not error if the annotation doesn't exist.
    }

    // Taskwarrior uses `denotate` command. It expects the filter, then `denotate` and then the annotation string.
    // Example: task <uuid> denotate "This is the exact annotation text"
    // It's important that the annotation text matches exactly, including case and whitespace.
    // The `annotation` field from the request should be the exact string.

    // Shell escaping for the annotation text (similar to addAnnotation)
    const escapedAnnotation = annotation.replace(/'/g, `'\''`);

    executeTaskWarriorCommandRaw([uuid, "denotate", `'${escapedAnnotation}'`]);

    // Fetch the updated task to confirm the change
    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' had annotation removed, but could not be retrieved afterwards.`,
      };
    }

    return updatedTask;
  } catch (error: unknown) {
    console.error("Error in removeAnnotationHandler:", error);
    let message = "Failed to remove annotation.";
    if (error instanceof Error) {
      message = error.message;
    }
    return { error: message };
  }
};
 