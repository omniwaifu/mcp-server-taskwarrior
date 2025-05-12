import type {
  ListTasksRequest,
  TaskWarriorTask,
  ErrorResponse,
} from "../../types/task.js";
import { executeTaskWarriorCommandJson } from "../../utils/taskwarrior.js";

export async function handleListTasks(
  args: ListTasksRequest,
): Promise<TaskWarriorTask[] | ErrorResponse> {
  const filters: string[] = [];

  if (args.project) {
    filters.push(`project:${args.project}`);
  }
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach((tag) => filters.push(`+${tag}`));
  }
  if (args.status) {
    filters.push(`status:${args.status}`);
  }
  if (args.descriptionContains) {
    filters.push(`description.contains:${args.descriptionContains}`);
  }
  if (args.dueBefore) {
    filters.push(`due.before:${args.dueBefore}`);
  }
  if (args.dueAfter) {
    filters.push(`due.after:${args.dueAfter}`);
  }
  if (args.scheduledBefore) {
    filters.push(`scheduled.before:${args.scheduledBefore}`);
  }
  if (args.scheduledAfter) {
    filters.push(`scheduled.after:${args.scheduledAfter}`);
  }
  if (args.modifiedBefore) {
    filters.push(`modified.before:${args.modifiedBefore}`);
  }
  if (args.modifiedAfter) {
    filters.push(`modified.after:${args.modifiedAfter}`);
  }
  if (args.limit) {
    filters.push(`limit:${args.limit}`);
  }

  // Always add export unless it's already there implicitly via a report name
  // executeTaskWarriorCommandJson handles adding "export" if not present.
  // filters.push("export"); // No longer needed here

  try {
    const tasks = await executeTaskWarriorCommandJson(filters);
    return tasks;
  } catch (error: unknown) {
    console.error("Error in handleListTasks:", error);
    let message = "Failed to list tasks.";
    let details: string | undefined;
    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === "string") {
      message = error;
    }
    return { error: message, details };
  }
}
