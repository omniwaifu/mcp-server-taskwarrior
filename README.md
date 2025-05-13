# TaskWarrior MCP Server

This is a Model Context Protocol (MCP) server for TaskWarrior that allows AI agents and applications to interact with TaskWarrior directly.

## Overview

The MCP TaskWarrior server exposes TaskWarrior's functionality through a set of standardized tools that follow the MCP protocol. This allows AI agents to manage tasks, add annotations, mark tasks as complete, and perform other operations.

## Available Tools

The server provides the following tools:

- `get_next_tasks` - Get a list of all pending tasks based on TaskWarrior's 'next' algorithm
- `mark_task_done` - Mark a task as done (completed) using its UUID
- `add_task` - Add a new task with a description and optional properties
- `list_tasks` - Get a list of tasks as JSON objects based on flexible filters
- `get_task_details` - Get detailed information for a specific task by its UUID
- `modify_task` - Modify attributes of an existing task
- `start_task` - Mark a task as started by its UUID
- `stop_task` - Stop a task that is currently active
- `delete_task` - Delete a task by its UUID
- `add_annotation` - Add an annotation to an existing task
- `remove_annotation` - Remove an existing annotation from a task

## Response Format

The server now follows the standard MCP response format:

```typescript
// Success response format
{
  content: [
    {
      type: "text",
      text: JSON.stringify(data)
    }
  ]
}

// Error response format
{
  content: [
    {
      type: "text",
      text: JSON.stringify({ error: "Error message" })
    }
  ]
}
```

## Migration Guide for Existing Tools

If you have client code that interacts with the TaskWarrior MCP server, you'll need to make these changes:

1. **Update tool names** - Tool names now use snake_case format (e.g., `list_tasks` instead of `listTasks`)

2. **Update response parsing** - Responses are now returned in the standard MCP format with a `content` array containing text items. The actual data is JSON stringified in the `text` field.

3. **Example client code**:
```typescript
// When calling a tool:
const response = await client.callTool({
  name: "list_tasks", // Use snake_case
  arguments: args,
});

// When parsing responses:
if (response?.content && Array.isArray(response.content)) {
  for (const item of response.content) {
    if (item?.type === 'text' && item?.text) {
      try {
        // Parse the JSON string in the text field
        const data = JSON.parse(item.text);
        // Use the data...
      } catch (e) {
        // Handle parsing error
      }
    }
  }
}
```

## Installation & Usage

1. Clone this repository
2. Install dependencies with `npm install`
3. Build with `npm run build`
4. Run with `npm start`

## Requirements

- Node.js 18 or higher
- TaskWarrior installed and configured on the system
