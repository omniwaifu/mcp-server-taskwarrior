# TaskWarrior MCP Server

Node.js server implementing Model Context Protocol (MCP) for [TaskWarrior](https://taskwarrior.org/) operations.

<a href="https://glama.ai/mcp/servers/e8w3e1su1x">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/e8w3e1su1x/badge" alt="TaskWarrior Server MCP server" />
</a>

## Features

- List tasks with extensive filtering (by description, project, tags, dates, limit)
- Add new tasks with descriptions, due dates, priorities, projects, and tags
- Get detailed information for a specific task by its UUID
- Modify existing tasks (description, status, due date, priority, project, tags) by UUID
- Mark tasks as complete (done) by UUID
- Start and stop tasks (track active work) by UUID
- Delete tasks by UUID
- Add and remove annotations from tasks by UUID

**Note**: This runs your local `task` binary, so TaskWarrior needs to be installed and configured!

> [!NOTE]
> All tools that operate on a specific task now strictly require the task's UUID. This ensures unambiguous targeting of tasks and avoids issues related to Taskwarrior's internal ID renumbering.

## API

### Tools

All tools that accept a task identifier now strictly require a `uuid` parameter (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

- **`list_tasks`**

  - Get a list of tasks with flexible filtering. This tool does not operate on a single task UUID but filters the entire task list.
  - Optional filters:
    - `project`: Filter by project name (e.g., `Home`).
    - `tags`: Filter by one or more tags (e.g., `["work", "urgent"]`). Tags are combined with AND logic if multiple are provided.
    - `descriptionContains`: Filter tasks whose description contains the given text.
    - `dueBefore`: Filter tasks due before a given ISO date string.
    - `dueAfter`: Filter tasks due after a given ISO date string.
    - `scheduledBefore`: Filter tasks scheduled before a given ISO date string.
    - `scheduledAfter`: Filter tasks scheduled after a given ISO date string.
    - `modifiedBefore`: Filter tasks modified before a given ISO date string.
    - `modifiedAfter`: Filter tasks modified after a given ISO date string.
    - `limit`: Limit the number of tasks returned.

- **`add_task`**

  - Add a new task to TaskWarrior.
  - Required:
    - `description`: Task description text.
  - Optional:
    - `due`: Due date (ISO timestamp).
    - `priority`: Priority level ("H", "M", or "L").
    - `project`: Project name.
    - `tags`: Array of tags.

- **`mark_task_done`**

  - Mark a task as completed.
  - Required:
    - `uuid`: Task UUID.

- **`get_task_details`**

  - Retrieve detailed information for a specific task.
  - Required:
    - `uuid`: Task UUID.

- **`modify_task`**

  - Modify attributes of an existing task.
  - Required:
    - `uuid`: Task UUID of the task to modify.
  - Optional (at least one modification must be provided):
    - `description`: New task description text.
    - `status`: New task status (e.g., `"pending"`, `"waiting"`, `"recurring"`; note: `"completed"` should be set via `mark_task_done`, `"deleted"` via `delete_task`).
    - `due`: New due date (ISO timestamp). Can be set to `null` to remove the due date.
    - `priority`: New priority level ("H", "M", "L", or `null` to remove).
    - `project`: New project name. Can be set to `null` or an empty string to remove the project.
    - `addTags`: Array of tags to add.
    - `removeTags`: Array of tags to remove.

- **`start_task`**

  - Mark a task as started (active).
  - Required:
    - `uuid`: Task UUID.

- **`stop_task`**

  - Stop a task that is currently active (removes start time).
  - Required:
    - `uuid`: Task UUID.

- **`delete_task`**

  - Delete a task.
  - Required:
    - `uuid`: Task UUID.
  - Optional:
    - `skipConfirmation`: Boolean (default `false`). If `true`, skips Taskwarrior's confirmation prompt.

- **`add_annotation`**

  - Add an annotation to an existing task.
  - Required:
    - `uuid`: Task UUID.
    - `annotation`: The annotation text (string).

- **`remove_annotation`**
  - Remove an annotation from a task.
  - Required:
    - `uuid`: Task UUID.
    - `annotation`: The exact text of the annotation to remove.

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taskwarrior": {
      "command": "npx",
      "args": ["-y", "mcp-server-taskwarrior"]
    }
  }
}
```

## Installation

```bash
npm install -g mcp-server-taskwarrior
```

Make sure you have TaskWarrior (`task`) installed and configured on your system.

## Example usage ideas:

- "What are my current work tasks?"
  - MCP Call: `list_tasks` with `project: "work"`
- "Add a task: Call my sister, high priority, due tomorrow"
  - MCP Call: `add_task` with `description: "Call my sister"`, `priority: "H"`, `due: "<tomorrow_ISO_date>"`
- "Start working on task with UUID xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  - MCP Call: `start_task` with `uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
- "Add a note to task with UUID xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx: Remember to buy milk"
  - MCP Call: `add_annotation` with `uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`, `annotation: "Remember to buy milk"`
- "I've finished task with UUID xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."
  - MCP Call: `mark_task_done` with `uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
- "Show me details for task with uuid xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  - MCP Call: `get_task_details` with `uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
- "Change the project of task with UUID xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx to 'Personal' and add tag 'quick'"
  - MCP Call: `modify_task` with `uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`, `project: "Personal"`, `addTags: ["quick"]`

## License

This MCP server is licensed under the MIT License. See the LICENSE file for details.
