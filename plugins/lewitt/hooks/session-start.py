#!/usr/bin/env python3
"""SessionStart hook that makes a session in a Lewitt product folder the designer.

In a folder with no .lewitt/, it prints nothing. Otherwise it writes LEWITT_ROOT,
the plugin's install folder, and APP_REPO into .lewitt/paths, because commands run
through the Bash tool do not see CLAUDE_PLUGIN_ROOT. Then it prints the context
the session starts with: that Lewitt is set up, the skill that holds the way of
working, and each project in progress.
"""

import os
import re
import subprocess
import sys
from pathlib import Path


def home_relative(path):
    home = str(Path.home())
    text = str(path)
    return "$HOME" + text[len(home):] if text == home or text.startswith(home + "/") else text


def put(text, name, value):
    """Sets one variable in the shell text of .lewitt/paths, keeping the other lines."""
    line = f'{name}="{value}"'
    pattern = re.compile(rf"^{name}=.*$", re.M)
    if pattern.search(text):
        return pattern.sub(lambda _: line, text, count=1)
    return text + ("" if text.endswith("\n") or not text else "\n") + line + "\n"


def projects(root):
    """Each worktree with a run folder: its path and the first heading of project.md."""
    listing = subprocess.run(
        ["git", "-C", str(root), "worktree", "list", "--porcelain"],
        capture_output=True, text=True,
    ).stdout
    found = []
    for line in listing.splitlines():
        if not line.startswith("worktree "):
            continue
        project = Path(line.removeprefix("worktree ")) / ".lewitt-run" / "project.md"
        if not project.is_file():
            continue
        heading = next(
            (row.lstrip("# ").strip() for row in project.read_text().splitlines() if row.strip()),
            "",
        )
        found.append((project.stat().st_mtime, project.parent.parent, heading))
    return [(folder, heading) for _, folder, heading in sorted(found, reverse=True)]


def main():
    sys.stdin.read()
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()).resolve()
    lewitt = root / ".lewitt"
    if not lewitt.is_dir():
        return 0

    plugin = os.environ.get("CLAUDE_PLUGIN_ROOT")
    paths = lewitt / "paths"
    if plugin:
        text = paths.read_text() if paths.is_file() else ""
        text = put(text, "LEWITT_ROOT", home_relative(Path(plugin).resolve()))
        text = put(text, "APP_REPO", home_relative(root))
        paths.write_text(text)

    lines = [
        "Lewitt is set up in this folder. This session is the designer of a Lewitt product design team, "
        "and the person is the design lead.",
        "The lewitt:designer skill holds the way of working. The designer loads it before its first reply.",
        "The product's notes, roles and pointers are in .lewitt/. Lewitt's scripts, guides and templates are "
        "in the folder LEWITT_ROOT names in .lewitt/paths.",
    ]
    if not (lewitt / "roles.md").is_file():
        lines.append("The setup is incomplete: .lewitt/roles.md is missing. /lewitt:start finishes it.")
    found = projects(root)
    if found:
        lines.append("Projects in progress, latest first:")
        lines += [f"- {heading or 'Untitled'}: {folder}/.lewitt-run/" for folder, heading in found]
        lines.append("/lewitt:resume reports the latest project's stage and next step.")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
