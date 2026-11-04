#!/usr/bin/env python3
"""PreToolUse hook for a sub-agent that may write only its own memory and the folders named.

Usage in a sub-agent's frontmatter: memory-only-writes.py <agent name> [folder ...]

Allows Write and Edit inside .claude/agent-memory/<agent name>/ in this repository, and
inside each folder named after the agent name. A folder is the name of a variable in
lewitt.env, such as WORKTREES_DIR, a path relative to this repository, or a path that
starts with ~. Blocks Write and Edit everywhere else. Exit code 2 blocks the call and
sends stderr to the agent.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def pointer(name):
    """The value of a variable in lewitt.env, with $HOME and earlier variables expanded."""
    if not (REPO / "lewitt.env").exists():
        return ""
    return subprocess.run(
        ["sh", "-c", f'set -a; . ./lewitt.env; printf %s "${name}"'],
        cwd=REPO, capture_output=True, text=True,
    ).stdout


agent = sys.argv[1]
allowed = [(REPO / ".claude" / "agent-memory" / agent).resolve()]
for folder in sys.argv[2:]:
    if re.fullmatch(r"[A-Z_]+", folder):
        folder = pointer(folder)
        if not folder:
            continue
    path = Path(folder).expanduser()
    allowed.append((path if path.is_absolute() else REPO / path).resolve())

call = json.load(sys.stdin)
path = call.get("tool_input", {}).get("file_path", "")
target = (Path(call.get("cwd", REPO)) / path).resolve()

if any(target == root or root in target.parents for root in allowed):
    sys.exit(0)
names = ", ".join(str(root) for root in allowed)
print(f"The {agent} writes only in {names}. Return everything else to the agent that "
      "started you.", file=sys.stderr)
sys.exit(2)
