import type {
  RemoveAnnotationRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export const removeAnnotationHandler = async (
  args: RemoveAnnotationRequest,
): Promise<TaskWarriorTask | ErrorResponse> => {
  const { uuid, annotation } = args;

  try {
    const taskToModify = await getTaskByUuid(uuid);
    if (!taskToModify) {
      return {
        error: `Task with UUID '${uuid}' not found. Cannot remove annotation.`,
      };
    }

    const existingAnnotation = taskToModify.annotations?.find(
      (a) => a.description === annotation,
    );

    if (!existingAnnotation) {
      return {
        error: `Annotation "${annotation}" not found on task '${uuid}'.`,
        details:
          "No changes made as the specified annotation does not exist on the task.",
      };
    }

    const escapedAnnotation = annotation.replace(/'/g, `'\''`);
    executeTaskWarriorCommandRaw([uuid, "denotate", `'${escapedAnnotation}'`]);

    const updatedTask = await getTaskByUuid(uuid);
    if (!updatedTask) {
      return {
        error: `Task with UUID '${uuid}' had annotation removed, but could not be retrieved afterwards.`,
        details: "Denotate command was issued, but subsequent fetch failed.",
      };
    }

    return updatedTask;
  } catch (error: unknown) {
    console.error("Error in removeAnnotationHandler:", error);
    let message = "Failed to remove annotation.";
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
