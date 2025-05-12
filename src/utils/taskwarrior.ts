import { execSync, ExecSyncOptionsWithStringEncoding } from "child_process";
import { TaskWarriorTask, TaskWarriorTaskSchema } from "../types/task.js"; // Assuming TaskWarriorTaskSchema is the Zod schema
import { z } from "zod";
import { isValidUuid } from "./uuid.js";

const defaultExecOptions: ExecSyncOptionsWithStringEncoding = {
  encoding: "utf-8",
  maxBuffer: 1024 * 1024 * 10, // 10 MB
  stdio: "pipe", // Inherit stdio to see errors, but pipe output for capture
};

/**
 * Executes a raw Taskwarrior command.
 * @param commandArgs Array of arguments for the task command (e.g., ["status:pending", "export"])
 * @param options execSync options
 * @returns The raw string output from the command.
 */
export function executeTaskWarriorCommandRaw(
  commandArgs: string[],
  options?: ExecSyncOptionsWithStringEncoding,
): string {
  const finalOptions = { ...defaultExecOptions, ...options };
  try {
    // It's often safer to escape arguments if they might contain shell special characters,
    // but taskwarrior CLI arguments are usually simple strings or specific formats.
    // For now, direct join, but consider argument sanitization/escaping for complex inputs.
    const command = `task ${commandArgs.join(" ")}`;
    console.log(`Executing: ${command}`); // For debugging
    return execSync(command, finalOptions).toString().trim();
  } catch (error: any) {
    // Log the error and stderr if available
    console.error(
      `Error executing TaskWarrior command: task ${commandArgs.join(" ")}`,
    );
    if (error.stderr) {
      console.error(`TaskWarrior stderr: ${error.stderr.toString().trim()}`);
    }
    if (error.stdout) {
      // Sometimes error output goes to stdout
      console.error(
        `TaskWarrior stdout (on error): ${error.stdout.toString().trim()}`,
      );
    }
    // Re-throw a more specific error or handle as needed
    throw new Error(
      `TaskWarrior command failed: ${error.message}` +
        (error.stderr ? ` (stderr: ${error.stderr.toString().trim()})` : ""),
    );
  }
}

/**
 * Executes a Taskwarrior command and expects a JSON array of tasks as output.
 * Parses the JSON and validates it against the TaskWarriorTaskSchema.
 * @param commandArgs Array of arguments for the task command (should include "export")
 * @returns Array of validated TaskWarriorTask objects.
 */
export async function executeTaskWarriorCommandJson(
  args: string[],
): Promise<TaskWarriorTask[]> {
  const rawOutput = await executeTaskWarriorCommandRaw(args);
  // Taskwarrior outputs JSON objects separated by newlines if there's more than one.
  // If it's a single object, it's not in an array. If it's multiple, they are not in an array.
  // If it's empty, it's an empty string.
  if (!rawOutput.trim()) {
    return [];
  }
  //சர Handle a single JSON object or multiple JSON objects separated by newlines
  const objects = rawOutput
    .trim()
    .split("\\n")
    .map((line) => JSON.parse(line));

  // Validate each object with Zod
  return objects.map((obj) => TaskWarriorTaskSchema.parse(obj));
}

/**
 * Retrieves a single task by its UUID.
 * Throws an error if the task is not found or if the identifier is not a UUID.
 * @param uuid The UUID of the task.
 * @returns The task object.
 */
export async function getTaskByUuid(uuid: string): Promise<TaskWarriorTask> {
  if (!isValidUuid(uuid)) {
    throw new Error("Invalid UUID format provided.");
  }

  const tasks = await executeTaskWarriorCommandJson([uuid, "export"]);
  if (tasks.length === 0) {
    throw new Error(`Task with UUID '${uuid}' not found.`);
  }
  if (tasks.length > 1) {
    // This should ideally not happen if UUIDs are unique
    console.warn(
      `Multiple tasks found for UUID '${uuid}'. Returning the first one.`,
    );
  }
  return tasks[0];
}

/**
 * Fetches a single task by its ID or UUID and validates it.
 * Returns null if not found or if multiple tasks are returned (which shouldn't happen with a unique ID/UUID).
 */
export function getTaskByIdOrUuid(idOrUuid: string): TaskWarriorTask | null {
  try {
    console.warn("getTaskByIdOrUuid is deprecated and may not function as expected with async changes. Use getTaskByUuid.");
    return null;
  } catch (error) {
    console.error(`Error fetching task by ID/UUID ${idOrUuid}:`, error);
    return null; // Or rethrow depending on desired error handling for callers
  }
}
