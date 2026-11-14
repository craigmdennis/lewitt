#!/usr/bin/env python3
"""PreToolUse hook that holds each Lewitt role to its own folders.

Plugin agents cannot declare hooks, so this one plugin hook covers every role. A
call made inside a sub-agent carries `agent_type`. For a Lewitt role, the hook:

- allows Write, Edit, MultiEdit and NotebookEdit only in the role's memory folder,
  .lewitt/agent-memory/<role>/, and, for a role that writes worktrees, in the folder
  WORKTREES_DIR names in .lewitt/paths;
- blocks git push and every gh command that changes something on GitHub.

A role is Lewitt's when it is built in, as listed in BUILT_IN, or when the
product's .lewitt/roles.md lists its agent type with a "Writes" column. Every other
agent type, and the main session, passes. Exit code 2 blocks the call and sends
stderr to the agent.

The hook stops a role's mistakes. It is no sandbox: a shell command can still
write a file, and the push check matches the command text only.
"""

import json
import os
import re
import sys
from pathlib import Path

PLUGIN = "lewitt:"
# What each built-in role writes besides its memory.
BUILT_IN = {
    "copywriter": set(),
    "researcher": set(),
    "frontend-engineer": {"worktrees"},
    "macos-engineer": {"worktrees"},
}
FILE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}
REMOTE_WRITES = [
    # git, any options with their values, then push: git -C <dir> push.
    r"\bgit(?:\s+-\S+(?:\s+[^-\s]\S*)?)*\s+push\b",
    r"\bgh\s+(pr|issue)\s+(create|edit|merge|close|reopen|comment|review|ready|lock|unlock|delete)\b",
    r"\bgh\s+(release|repo|secret|variable|workflow|run)\s+(create|edit|delete|set|enable|disable|rerun|cancel|run)\b",
    r"\bgh\s+api\b.*(-X|--method)\s*(POST|PATCH|PUT|DELETE)\b",
    r"\bgh\s+api\b.*\s(-f|-F|--field|--raw-field|--input)\s",
]


def project_root(call):
    """The folder that holds .lewitt/: the project folder, or the nearest parent of cwd."""
    start = Path(os.environ.get("CLAUDE_PROJECT_DIR") or call.get("cwd") or ".").resolve()
    for folder in [start, *start.parents]:
        if (folder / ".lewitt").is_dir():
            return folder
    return None


def product_roles(root):
    """Each role in .lewitt/roles.md with a Writes column: agent type -> extra folders."""
    roles = {}
    path = root / ".lewitt" / "roles.md"
    if not path.is_file():
        return roles
    for line in path.read_text().splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        kind = re.search(r"`([^`]+)`", cells[1])
        if not kind or "memory" not in cells[2].lower():
            continue
        roles[kind.group(1).removeprefix(PLUGIN)] = {"worktrees"} if "worktrees" in cells[2].lower() else set()
    return roles


def worktrees_dir(root):
    """WORKTREES_DIR from .lewitt/paths, with $HOME and earlier variables expanded.

    The file is read as KEY="value" lines and never run, because a repository can
    hold a .lewitt/paths of its own.
    """
    paths = root / ".lewitt" / "paths"
    if not paths.is_file():
        return None
    known = {"HOME": str(Path.home())}
    for line in paths.read_text().splitlines():
        match = re.fullmatch(r'\s*([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|(\S*))\s*', line)
        if match:
            raw = match.group(2) if match.group(2) is not None else match.group(3)
            known[match.group(1)] = re.sub(
                r"\$\{?([A-Z_][A-Z0-9_]*)\}?", lambda ref: known.get(ref.group(1), ""), raw
            )
    value = known.get("WORKTREES_DIR", "")
    if not value:
        return None
    path = Path(value).expanduser()
    return (path if path.is_absolute() else root / path).resolve()


def main():
    call = json.load(sys.stdin)
    agent = call.get("agent_type")
    if not agent:
        return 0
    role = agent.removeprefix(PLUGIN)
    root = project_root(call)
    roles = dict(BUILT_IN)
    if root:
        roles.update(product_roles(root))
    if role not in roles:
        return 0

    tool = call.get("tool_name", "")
    params = call.get("tool_input", {}) or {}
    if tool == "Bash":
        command = params.get("command", "")
        if any(re.search(pattern, command, re.IGNORECASE) for pattern in REMOTE_WRITES):
            print("This command writes to GitHub. Return the command to the designer, who runs it "
                  "after the design lead approves.", file=sys.stderr)
            return 2
        return 0
    if tool not in FILE_TOOLS:
        return 0

    if not root:
        print(f"The {role} writes only in a folder set up for Lewitt, and this folder has no "
              ".lewitt/.", file=sys.stderr)
        return 2
    allowed = [(root / ".lewitt" / "agent-memory" / role).resolve()]
    if "worktrees" in roles[role]:
        folder = worktrees_dir(root)
        if folder:
            allowed.append(folder)
    path = params.get("file_path") or params.get("notebook_path") or ""
    target = (Path(call.get("cwd") or root) / path).resolve()
    if any(target == folder or folder in target.parents for folder in allowed):
        return 0
    names = ", ".join(str(folder) for folder in allowed)
    print(f"The {role} writes only in {names}. Return everything else to the designer.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
