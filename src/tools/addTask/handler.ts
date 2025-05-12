// import { z } from "zod";
import type {
  AddTaskRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import {
  executeTaskWarriorCommandRaw,
  executeTaskWarriorCommandJson,
  getTaskByUuid,
} from "../../utils/taskwarrior.js";

export async function handleAddTask(
  args: AddTaskRequest,
): Promise<TaskWarriorTask[] | ErrorResponse> {
  console.log("handleAddTask called with:", args);

  const addCommandArgs: string[] = ["add"];
  addCommandArgs.push(`"${args.description.replace(/"/g, '\\"')}"`); // Ensure description is quoted and internal quotes escaped

  if (args.due) {
    addCommandArgs.push(`due:${args.due}`);
  }
  if (args.priority) {
    addCommandArgs.push(`priority:${args.priority}`);
  }
  if (args.project) {
    addCommandArgs.push(`project:${args.project}`);
  }
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach((tag) => addCommandArgs.push(`+${tag}`));
  }

  try {
    // Construct the command arguments
    const commandArgs = [args.description];
    // ... (optional fields handling) ...
    if (args.due) commandArgs.push(`due:${args.due}`);
    if (args.priority) commandArgs.push(`priority:${args.priority}`);
    if (args.project) commandArgs.push(`project:${args.project}`);
    if (args.tags && args.tags.length > 0) {
      args.tags.forEach((tag) => commandArgs.push(`+${tag}`));
    }

    // Execute the command to add the task
    // Taskwarrior add command usually outputs a message like "Created task 123."
    // We need to capture the UUID of the newly created task.
    // One way is to list tasks matching the description immediately after adding,
    // assuming descriptions are unique enough for this context, or use `task _get <id>.uuid` if we can get the ID.
    // A safer way: `task add ...` then `task /<description_pattern>/ limit:1 export`
    // Or, if `task add` outputs the ID: task <ID> export to get its JSON and thus UUID.
    const addOutput = executeTaskWarriorCommandRaw(commandArgs);
    console.log("TaskWarrior add output:", addOutput);

    // Extract UUID. This is a bit fragile and depends on Taskwarrior output format.
    // Example output: "Created task 1 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)."
    // Or just "Created task 1."
    // If it gives the ID, we can then fetch by ID.
    let createdTaskUuid: string | undefined;
    const idMatch = addOutput.match(/Created task (\d+)/);

    if (idMatch && idMatch[1]) {
      const newTaskId = idMatch[1];
      // Fetch the task by its new ID to get its full details including UUID
      const newlyAddedTasks = await executeTaskWarriorCommandJson([
        newTaskId,
        "export",
      ]);
      if (newlyAddedTasks.length > 0) {
        createdTaskUuid = newlyAddedTasks[0].uuid;
      }
    } else {
      // Fallback: if ID not in output, try to find by exact description (less reliable)
      // This assumes the description is unique enough for an immediate fetch.
      console.warn(
        "Could not parse new task ID from 'add' output. Falling back to description match.",
      );
      const newTasks = await executeTaskWarriorCommandJson([
        `description:"${args.description.replace(/"/g, '\\"')}"`, // Ensure description is quoted and escaped
        "limit:1",
        "export",
      ]);
      if (newTasks.length > 0) {
        createdTaskUuid = newTasks[0].uuid;
      }
    }

    if (!createdTaskUuid) {
      return {
        error: "Failed to retrieve the newly created task or its UUID.",
        details: "Task added but UUID could not be determined.",
      };
    }

    // Fetch the task by its UUID to return the full object
    const createdTask = await getTaskByUuid(createdTaskUuid);
    if (!createdTask) {
      // Should not happen if UUID was just found
      return {
        error: `Failed to fetch newly created task with UUID: ${createdTaskUuid}`,
        details:
          "Task was added and UUID determined, but subsequent fetch failed.",
      };
    }
    return [createdTask];
  } catch (error: unknown) {
    console.error("Error in handleAddTask:", error);
    let message = "Failed to add task.";
    let details: string | undefined;
    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === "string") {
      message = error;
    }
    return {
      error: message,
      details,
    };
  }
}
