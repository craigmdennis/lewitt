#!/usr/bin/env python3
"""PreToolUse hook on Bash for a sub-agent that may read GitHub but never write to it.

Blocks git push and every gh command that changes something on GitHub: a pull request
or issue created, edited, merged, closed, commented on or reviewed, and a gh api call
with a method other than GET or with fields. The designer runs those commands after the
design lead approves. Exit code 2 blocks the call and sends stderr to the agent.
"""

import json
import re
import sys

command = json.load(sys.stdin).get("tool_input", {}).get("command", "")

BLOCKED = [
    r"\bgit\s+push\b",
    r"\bgh\s+(pr|issue)\s+(create|edit|merge|close|reopen|comment|review|ready|lock|unlock|delete)\b",
    r"\bgh\s+(release|repo|secret|variable|workflow|run)\s+(create|edit|delete|set|enable|disable|rerun|cancel|run)\b",
    r"\bgh\s+api\b.*(-X|--method)\s*(POST|PATCH|PUT|DELETE)\b",
    r"\bgh\s+api\b.*\s(-f|-F|--field|--raw-field|--input)\s",
]

for pattern in BLOCKED:
    if re.search(pattern, command, re.IGNORECASE):
        print("This command writes to GitHub. Return the command to the designer, who runs "
              "it after the design lead approves.", file=sys.stderr)
        sys.exit(2)
sys.exit(0)
