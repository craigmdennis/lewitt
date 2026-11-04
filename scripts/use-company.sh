#!/bin/sh
# Point this checkout at one company's folder.
#
# The company folder sits outside this repository and holds everything that
# belongs to one company: the company guides, machine.env, agent memory, run
# folders, worktrees, skills.md and denylist. This script creates the folder
# when it is missing, and replaces these links in this checkout:
#
#   company              -> <folder>
#   machine.env          -> <folder>/machine.env
#   runs                 -> <folder>/runs
#   worktrees            -> <folder>/worktrees
#   .claude/agent-memory -> <folder>/agent-memory
#
# It also turns on the pre-commit check in .githooks/, which blocks a commit
# that adds a term from <folder>/denylist.
#
# Usage: scripts/use-company.sh <folder>
set -eu
[ $# -eq 1 ] || { echo "Usage: scripts/use-company.sh <folder>" >&2; exit 1; }
cd "$(dirname "$0")/.."
mkdir -p "$1"
folder="$(cd "$1" && pwd)"
mkdir -p "$folder/runs" "$folder/worktrees" "$folder/agent-memory"
[ -e "$folder/machine.env" ] || cp machine.env.example "$folder/machine.env"
[ -e "$folder/denylist" ] || printf '# One term per line. A commit to Lewitt that adds a line containing a term fails.\n' > "$folder/denylist"
for pair in "company:$folder" "machine.env:$folder/machine.env" "runs:$folder/runs" \
            "worktrees:$folder/worktrees" ".claude/agent-memory:$folder/agent-memory"; do
  link="${pair%%:*}"
  target="${pair#*:}"
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    echo "$link is a real file or folder. Move its contents into $target, then run this again." >&2
    exit 1
  fi
  ln -sfn "$target" "$link"
done
git config core.hooksPath .githooks
echo "This checkout now uses $folder"
