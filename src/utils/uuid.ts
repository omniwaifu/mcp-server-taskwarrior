import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Checks if the given string is a valid UUID.
 * @param id The string to check.
 * @returns True if the string is a valid UUID, false otherwise.
 */
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// isValidTaskwarriorIdFormat and getIdentifierType removed as they are no longer needed
// when strictly using UUIDs for task identification.

// Further ID-to-UUID resolution logic would typically involve calling Taskwarrior
// to list tasks and find a match, which might be better suited for specific
// tool handlers or a more advanced utility within `taskwarrior.ts` that can
// take a context (like a project or tags) to narrow down the search for an ID.
// For now, this file focuses on basic validation and type determination.
