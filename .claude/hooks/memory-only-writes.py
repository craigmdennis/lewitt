#!/usr/bin/env python3
"""PreToolUse hook for a sub-agent that may write only its own memory and the folders named.

Usage in a sub-agent's frontmatter: memory-only-writes.py <agent name> [folder ...]

Allows Write and Edit inside .claude/agent-memory/<agent name>/ in this repository, and
inside each folder named after the agent name. A folder is a path relative to this
repository, or a path that starts with ~. Blocks Write and Edit everywhere else. Exit
code 2 blocks the call and sends stderr to the agent.
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

agent = sys.argv[1]
allowed = [(REPO / ".claude" / "agent-memory" / agent).resolve()]
for folder in sys.argv[2:]:
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
