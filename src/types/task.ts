import { z } from "zod";

// Base task schema that covers common TaskWarrior fields
export const TaskWarriorTaskSchema = z.object({
  id: z.number().int(), // Added ID field
  uuid: z.string().uuid(),
  description: z.string(),
  status: z.enum(["pending", "completed", "deleted", "waiting", "recurring"]),
  entry: z.string(), // Accept any string format for dates from TaskWarrior
  modified: z.string().optional(), // Accept any string format for dates
  start: z.string().optional(), // Accept any string format for dates
  due: z.string().optional(), // Accept any string format for dates
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
  annotations: z
    .array(
      z.object({
        entry: z.string(), // Accept any string format for dates
        description: z.string(),
      }),
    )
    .optional(),
  // Add other fields from Taskwarrior JSON export as needed
}).passthrough(); // Allow additional fields from TaskWarrior without validation errors

export type TaskWarriorTask = z.infer<typeof TaskWarriorTaskSchema>;

// Request schemas for tool inputs

export const ListPendingTasksRequestSchema = z.object({
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});
export type ListPendingTasksRequest = z.infer<
  typeof ListPendingTasksRequestSchema
>;

export const ListTasksRequestSchema = z.object({
  status: z
    .enum(["pending", "completed", "deleted", "waiting", "recurring"])
    .optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
  descriptionContains: z.string().optional(), // For description.contains filter
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  scheduledBefore: z.string().optional(),
  scheduledAfter: z.string().optional(),
  modifiedBefore: z.string().optional(),
  modifiedAfter: z.string().optional(),
  limit: z.number().int().positive().optional(),
  // Consider adding more filter options here as the tool evolves
});
export type ListTasksRequest = z.infer<typeof ListTasksRequestSchema>;

export const MarkTaskDoneRequestSchema = z.object({
  uuid: z.string().uuid(),
});
export type MarkTaskDoneRequest = z.infer<typeof MarkTaskDoneRequestSchema>;

export const AddTaskRequestSchema = z.object({
  description: z.string(),
  due: z.string().optional(), // Any string format
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});
export type AddTaskRequest = z.infer<typeof AddTaskRequestSchema>;

// Schemas for new tools to be implemented will go here, e.g.:
export const GetTaskDetailsRequestSchema = z.object({
  uuid: z.string().uuid(),
});
export type GetTaskDetailsRequest = z.infer<typeof GetTaskDetailsRequestSchema>;

export const ModifyTaskRequestSchema = z.object({
  uuid: z.string().uuid(),
  description: z.string().optional(),
  status: z
    .enum(["pending", "completed", "deleted", "waiting", "recurring"])
    .optional(),
  due: z.string().optional(), // Any string format
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]*$/) // Allow empty string for removal
    .optional(),
  addTags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
  removeTags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
});
export type ModifyTaskRequest = z.infer<typeof ModifyTaskRequestSchema>;

export const StartTaskRequestSchema = z.object({
  uuid: z.string().uuid(),
});
export type StartTaskRequest = z.infer<typeof StartTaskRequestSchema>;

export const StopTaskRequestSchema = z.object({
  uuid: z.string().uuid(),
});
export type StopTaskRequest = z.infer<typeof StopTaskRequestSchema>;

export const DeleteTaskRequestSchema = z.object({
  uuid: z.string().uuid(),
  skipConfirmation: z.boolean().optional(),
});
export type DeleteTaskRequest = z.infer<typeof DeleteTaskRequestSchema>;

export const AddAnnotationRequestSchema = z.object({
  uuid: z.string().uuid(),
  annotation: z.string(),
});
export type AddAnnotationRequest = z.infer<typeof AddAnnotationRequestSchema>;

export const RemoveAnnotationRequestSchema = z.object({
  uuid: z.string().uuid(),
  annotation: z.string(), // Exact text of the annotation to remove
});
export type RemoveAnnotationRequest = z.infer<
  typeof RemoveAnnotationRequestSchema
>;

// Response Schemas specific to tools
export const AddAnnotationResponseSchema = z.object({
  task: TaskWarriorTaskSchema,
});
export type AddAnnotationResponse = z.infer<typeof AddAnnotationResponseSchema>;

export const DeleteTaskResponseSchema = z.object({
  message: z.string(),
  deletedUuid: z.string().uuid(),
});
export type DeleteTaskResponse = z.infer<typeof DeleteTaskResponseSchema>;

// General MCP Tool related types (might be useful if not already in SDK)
// export const MCPToolInputSchema = ToolSchema.shape.inputSchema; // Re-export or define if needed
// export type MCPToolInput = z.infer<typeof MCPToolInputSchema>;

// Generic error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.number().optional(),
  details: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Union of all possible successful (non-error, non-MCP wrapped) responses from tool handlers
export type ToolHandlerSuccessResponse =
  | TaskWarriorTask // For single task results
  | TaskWarriorTask[] // For list results or single task results returned as an array
  | DeleteTaskResponse
  | AddAnnotationResponse; // add_annotation returns the full AddAnnotationResponseSchema structure
// Add other specific success response types as needed, e.g., for modify, start, stop if they have unique structures.

// Ensure TaskWarriorTaskSchema is comprehensive for what handlers might return
// No changes needed to TaskWarriorTaskSchema itself for this step.
