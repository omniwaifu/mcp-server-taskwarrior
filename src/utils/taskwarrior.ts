import { execSync, ExecSyncOptionsWithStringEncoding } from "child_process";
import { TaskWarriorTask, TaskWarriorTaskSchema } from "../types/task.js"; // Assuming TaskWarriorTaskSchema is the Zod schema
import { isValidUuid } from "./uuid.js";

const defaultExecOptions: ExecSyncOptionsWithStringEncoding = {
  encoding: "utf-8",
  maxBuffer: 1024 * 1024 * 10, // 10 MB
  stdio: "pipe", // Inherit stdio to see errors, but pipe output for capture
};

// Type for error objects from execSync which might have stderr/stdout
interface ExecSyncError extends Error {
  stderr?: Buffer | string;
  stdout?: Buffer | string;
  status?: number; // execSync errors often have a status code
}

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
    const command = `task ${commandArgs.join(" ")}`;
    console.log(`Executing: ${command}`);
    return execSync(command, finalOptions).toString().trim();
  } catch (error: unknown) {
    console.error(
      `Error executing TaskWarrior command: task ${commandArgs.join(" ")}`,
    );
    let stderrMessage = "";
    let stdoutMessage = ""; // stdout might contain info even on error for some commands
    let errorMessage = "TaskWarrior command failed";

    if (typeof error === "object" && error !== null) {
      const execError = error as ExecSyncError;

      if (execError.stderr) {
        stderrMessage = Buffer.isBuffer(execError.stderr)
          ? execError.stderr.toString().trim()
          : String(execError.stderr).trim();
        console.error(`TaskWarrior stderr: ${stderrMessage}`);
      }
      if (execError.stdout) { // Capture stdout on error as well
        stdoutMessage = Buffer.isBuffer(execError.stdout)
          ? execError.stdout.toString().trim()
          : String(execError.stdout).trim();
        console.error(`TaskWarrior stdout (on error): ${stdoutMessage}`);
      }

      // Check for benign "no tasks" messages in stderr or stdout
      const noMatchRegex = /No matches|No tasks specified/i;
      if (noMatchRegex.test(stderrMessage)) {
        console.debug("[executeTaskWarriorCommandRaw] 'No matches' detected in stderr. Returning stderr content.");
        return stderrMessage; // Return the benign message for further processing
      }
      if (noMatchRegex.test(stdoutMessage)) {
        console.debug("[executeTaskWarriorCommandRaw] 'No matches' detected in stdout. Returning stdout content.");
        return stdoutMessage; // Return the benign message
      }

      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (stderrMessage) {
        errorMessage = stderrMessage;
      }
    }
    // If it wasn't a benign "no matches" message, throw the error.
    throw new Error(
      `${errorMessage}` + (stderrMessage ? ` (stderr: ${stderrMessage})` : ""),
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
  try {
    // Always add export if not already present
    if (!args.some(arg => arg.toLowerCase().includes('export'))) {
      args.push("export");
    }
    
    const rawOutput = executeTaskWarriorCommandRaw(args);

    // Handle known "no tasks" messages from Taskwarrior
    const trimmedOutput = rawOutput.trim();
    if (
      trimmedOutput === "No matches." ||
      trimmedOutput === "No tasks found." ||
      trimmedOutput === "No tasks." ||
      trimmedOutput === "No pending tasks." ||
      trimmedOutput === "" // Handles completely empty output
    ) {
      console.log(`executeTaskWarriorCommandJson - Received "No matches" equivalent: "${trimmedOutput}". Returning empty array.`);
      return [];
    }

    // Try to parse the entire output as a JSON array first
    try {
      // First attempt: try to parse the whole output as a single JSON array
      const parsedArray = JSON.parse(trimmedOutput);
      if (Array.isArray(parsedArray)) {
        console.log(`Successfully parsed output as a complete JSON array with ${parsedArray.length} items`);
        
        // Validate all objects in the array
        const validatedObjects = [];
        for (let i = 0; i < parsedArray.length; i++) {
          try {
            // The schema now allows passthrough of unknown fields
            const validatedObj = TaskWarriorTaskSchema.parse(parsedArray[i]);
            validatedObjects.push(validatedObj);
          } catch (validationError) {
            console.error(`Validation failed for task in array at index ${i}:`, 
              JSON.stringify(parsedArray[i]).substring(0, 100), validationError);
            // Skip invalid objects but continue with valid ones
          }
        }
        return validatedObjects;
      }
    } catch (wholeParseFailed) {
      console.log("Failed to parse output as a complete JSON array, trying line by line parsing");
    }

    // Fallback: If parsing the whole output failed, try parsing each line as a separate JSON object
    const validObjects = [];
    const lines = trimmedOutput.split("\n");
    
    for (const line of lines) {
      if (!line.trim() || line.trim() === '[' || line.trim() === ']') continue; // Skip empty lines and array brackets
      
      // Remove any trailing commas (common in pretty-printed JSON arrays)
      const cleanLine = line.trim().replace(/,\s*$/, '');
      
      try {
        const parsedObj = JSON.parse(cleanLine);
        validObjects.push(parsedObj);
      } catch (parseError) {
        console.error(`Failed to parse line: ${cleanLine.substring(0, 50)}... - Skipping this line and continuing.`, parseError);
      }
    }
    
    // If we couldn't parse any valid objects, return empty array
    if (validObjects.length === 0) {
      console.warn("No valid JSON objects could be parsed from TaskWarrior output. Returning empty array.");
      return [];
    }

    // Validate each object with Zod, skipping any that fail validation
    const validatedObjects = [];
    
    for (let i = 0; i < validObjects.length; i++) {
      const obj = validObjects[i];
      try {
        // The schema now allows passthrough of unknown fields
        const validatedObj = TaskWarriorTaskSchema.parse(obj);
        validatedObjects.push(validatedObj);
      } catch (validationError) {
        console.error(`Validation failed for task object at index ${i}:`, 
          JSON.stringify(obj).substring(0, 100), validationError);
        // Skip this object but continue with others - don't throw
      }
    }
    
    return validatedObjects;
  } catch (error) {
    // Special case for "No matches" that might have leaked through error handling
    if (error instanceof Error) {
      if (
        error.message.includes("No matches") || 
        error.message.includes("No tasks found") ||
        error.message.includes("No tasks") ||
        error.message.includes("No pending tasks")
      ) {
        console.log(`executeTaskWarriorCommandJson - Caught error with "No matches" pattern: "${error.message}". Returning empty array.`);
        return [];
      }
    }
    
    // For ANY other error, return empty array instead of throwing
    console.error("Error processing TaskWarrior JSON output:", error);
    return []; // Always return empty array on errors for robustness
  }
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
    console.warn(
      "getTaskByIdOrUuid is deprecated and may not function as expected with async changes. Use getTaskByUuid.",
    );
    return null;
  } catch (error) {
    console.error(`Error fetching task by ID/UUID ${idOrUuid}:`, error);
    return null; // Or rethrow depending on desired error handling for callers
  }
}
