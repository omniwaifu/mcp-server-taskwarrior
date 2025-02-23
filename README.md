# TaskWarrior MCP Server

Node.js server implementing Model Context Protocol (MCP) for [TaskWarrior](https://taskwarrior.org/) operations.

## Features

- View pending tasks
- Filter tasks by project and tags
- Add new tasks with descriptions, due dates, priorities, projects and tags
- Mark tasks as complete

**Note**: This runs your local `task` binary, so TaskWarrior needs to be installed and configured!

## API

### Tools

- **get_next_tasks**
  - Get a list of all pending tasks
  - Optional filters:
    - `project`: Filter by project name
    - `tags`: Filter by one or more tags

- **add_task**
  - Add a new task to TaskWarrior
  - Required:
    - `description`: Task description text
  - Optional:
    - `due`: Due date (ISO timestamp)
    - `priority`: Priority level ("H", "M", or "L")
    - `project`: Project name (lowercase with dots)
    - `tags`: Array of tags (lowercase)

- **mark_task_done**
  - Mark a task as completed
  - Required:
    - `identifier`: Task ID or UUID

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taskwarrior": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-taskwarrior"
      ]
    }
  }
}
```

## Installation

```bash
npm install -g mcp-server-taskwarrior
```

Make sure you have TaskWarrior (`task`) installed and configured on your system.

## Example Usage

1. List pending tasks:
```
get_next_tasks {}
```

2. Add a new high-priority task due tomorrow:
```
add_task {
  "description": "Finish project proposal",
  "due": "2024-02-23T17:00:00.000Z",
  "priority": "H",
  "project": "work",
  "tags": ["urgent", "proposal"]
}
```

3. Mark task as complete:
```
mark_task_done {
  "identifier": "123"
}
```

## License

This MCP server is licensed under the MIT License. See the LICENSE file for details.
