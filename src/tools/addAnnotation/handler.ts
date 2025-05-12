import type {
  AddAnnotationRequest,
  AddAnnotationResponse,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const addAnnotationHandler = async (
  args: AddAnnotationRequest,
): Promise<AddAnnotationResponse | ErrorResponse> => {
  // Validation is now done by src/index.ts
  // const validationResult = AddAnnotationRequestSchema.safeParse(body);
  // if (!validationResult.success) { ... }

  const { uuid, annotation } = args;

  try {
    await getTaskByUuid(uuid); // Ensure task exists

    await executeTaskWarriorCommandRaw([
      uuid,
      "annotate",
      `'${annotation.replace(/'/g, `'\''`)}'`, // Shell escape the annotation
    ]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: "Failed to fetch task after adding annotation.",
        details:
          "Annotation might have been added, but task data could not be retrieved.",
      };
    }

    return {
      task: updatedTask,
    };
  } catch (error: unknown) {
    console.error("Error in addAnnotationHandler:", error);
    let message = "Failed to add annotation.";
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
