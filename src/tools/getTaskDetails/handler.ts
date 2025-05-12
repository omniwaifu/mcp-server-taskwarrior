import { z } from "zod";
import {
  GetTaskDetailsRequestSchema,
  TaskWarriorTaskSchema,
  ErrorResponseSchema,
} from "../../types/task.js";
import { getTaskByUuid } from "../../utils/taskwarrior.js";

export const getTaskDetailsHandler = async (
  body: unknown,
): Promise<
  z.infer<typeof TaskWarriorTaskSchema> | z.infer<typeof ErrorResponseSchema>
> => {
  const validationResult = GetTaskDetailsRequestSchema.safeParse(body);

  if (!validationResult.success) {
    console.error("Validation Error:", validationResult.error.errors);
    return {
      error: "Invalid request body for getTaskDetails",
      details: validationResult.error.toString(),
    };
  }

  const { uuid } = validationResult.data;

  try {
    const task = await getTaskByUuid(uuid);
    if (!task) {
      return {
        error: `Task with UUID '${uuid}' not found.`,
      };
    }
    return { task: task! };
  } catch (error: unknown) {
    console.error("Error in getTaskDetailsHandler:", error);
    let message = "Failed to get task details.";
    if (error instanceof Error) {
      message = error.message;
    }
    return { error: message };
  }
};
 