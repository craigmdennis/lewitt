#!/usr/bin/env python3
"""Checks scope.py and session-start.py against a product folder made in a temporary folder.

Run: python3 plugins/lewitt/hooks/test_hooks.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HOOKS = Path(__file__).resolve().parent


def run(script, payload, root, plugin=None):
    env = {**os.environ, "CLAUDE_PROJECT_DIR": str(root)}
    if plugin:
        env["CLAUDE_PLUGIN_ROOT"] = plugin
    done = subprocess.run(
        [sys.executable, str(HOOKS / script)],
        input=json.dumps(payload), capture_output=True, text=True, env=env,
    )
    return done.returncode, done.stdout


def write(root, agent, path, tool="Write"):
    payload = {"cwd": str(root), "tool_name": tool, "tool_input": {"file_path": str(path)}}
    if agent:
        payload["agent_type"] = agent
    return run("scope.py", payload, root)[0]


def bash(root, agent, command):
    payload = {"cwd": str(root), "tool_name": "Bash", "tool_input": {"command": command}, "agent_type": agent}
    return run("scope.py", payload, root)[0]


def main():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp).resolve()

        # A folder with no .lewitt/ gets no session context.
        code, out = run("session-start.py", {}, root, plugin="/plugin")
        assert code == 0 and out == "", out

        (root / ".lewitt" / "worktrees").mkdir(parents=True)
        (root / ".lewitt" / "paths").write_text('WORKTREES_DIR="' + str(root / ".lewitt" / "worktrees") + '"\n')
        (root / ".lewitt" / "roles.md").write_text(
            "| Role | Agent type | Writes |\n|---|---|---|\n"
            "| Copywriter | `lewitt:copywriter` | memory |\n"
            "| Swift tester | `swift-tester` | memory, worktrees |\n"
        )
        memory = root / ".lewitt" / "agent-memory"
        tree = root / ".lewitt" / "worktrees" / "project" / "a.swift"

        # The main session and unknown agents pass.
        assert write(root, None, root / "README.md") == 0
        assert write(root, "Explore", root / "README.md") == 0
        # A built-in role writes its memory and nothing else.
        assert write(root, "lewitt:copywriter", memory / "copywriter" / "MEMORY.md") == 0
        assert write(root, "lewitt:copywriter", memory / "researcher" / "MEMORY.md") == 2
        assert write(root, "lewitt:copywriter", tree) == 2
        # A built-in engineer writes its worktrees.
        assert write(root, "lewitt:macos-engineer", tree, tool="Edit") == 0
        assert write(root, "lewitt:macos-engineer", root / "README.md") == 2
        # A role made in the product writes what roles.md gives it.
        assert write(root, "swift-tester", tree) == 0
        assert write(root, "swift-tester", memory / "swift-tester" / "MEMORY.md") == 0
        assert write(root, "swift-tester", root / "Package.swift") == 2
        # Lewitt roles never push, and other agents are left alone.
        assert bash(root, "lewitt:frontend-engineer", "git push origin HEAD") == 2
        assert bash(root, "swift-tester", "gh pr create --fill") == 2
        assert bash(root, "lewitt:frontend-engineer", "git status") == 0
        assert bash(root, "general-purpose", "git push") == 0

        # A product folder gets the context, and paths gets the plugin folder.
        code, out = run("session-start.py", {}, root, plugin="/plugin")
        assert code == 0 and "lewitt:designer" in out, out
        text = (root / ".lewitt" / "paths").read_text()
        assert 'LEWITT_ROOT="/plugin"' in text and "WORKTREES_DIR=" in text, text
        run("session-start.py", {}, root, plugin="/plugin")
        assert (root / ".lewitt" / "paths").read_text().count("LEWITT_ROOT=") == 1

    print("ok")


if __name__ == "__main__":
    main()
