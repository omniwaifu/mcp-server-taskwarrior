import { z } from "zod";

// Base task schema that covers common TaskWarrior fields
export const TaskWarriorTaskSchema = z.object({
  id: z.number().int(), // Added ID field
  uuid: z.string().uuid(),
  description: z.string(),
  status: z.enum(["pending", "completed", "deleted", "waiting", "recurring"]),
  entry: z.string().datetime(), // ISO timestamp
  modified: z.string().datetime().optional(), // ISO timestamp
  start: z.string().datetime().optional(), // ISO timestamp for when task was started
  due: z.string().optional(), // ISO timestamp
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]+$/)
    .optional(),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
  annotations: z
    .array(
      z.object({
        entry: z.string().datetime(),
        description: z.string(),
      }),
    )
    .optional(),
  // Add other fields from Taskwarrior JSON export as needed, e.g., id, urgency, etc.
});

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
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  scheduledBefore: z.string().datetime().optional(),
  scheduledAfter: z.string().datetime().optional(),
  modifiedBefore: z.string().datetime().optional(),
  modifiedAfter: z.string().datetime().optional(),
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
  due: z.string().optional(), // ISO timestamp
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
    .optional(), // Though `task modify` might not handle all status changes directly, e.g. `done` is a command.
  due: z.string().datetime().optional(), // Assuming ISO string. Taskwarrior is flexible here.
  priority: z.enum(["H", "M", "L"]).optional(),
  project: z
    .string()
    .regex(/^[a-zA-Z0-9 ._-]*$/)
    .optional(), // Allow empty string for removal
  addTags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
  removeTags: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)).optional(),
  // We can add more modifiable fields here based on `task help modify`
  // For annotations, separate tools `add_annotation` and `remove_annotation` are planned.
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
