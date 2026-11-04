#!/bin/sh
# Point this checkout at an app repository, where it already is.
#
# The app repository stays where it is, with its own folders. This script:
#
# 1. Clones the repository first when the first argument is a URL. The second
#    argument is the folder to clone it into.
# 2. Creates .lewitt/ in the repository's main checkout, for the notes about the
#    app and each sub-agent's memory, and hides .lewitt/ and .lewitt-run/ through
#    the repository's .git/info/exclude. The repository's own files and its
#    .gitignore are unchanged.
# 3. Writes APP_REPO in lewitt.env, from lewitt.env.example when it is missing.
#    When WORKTREES_DIR is empty, writes worktrees/ in this checkout, which git
#    ignores, and creates the folder.
# 4. Replaces two links in this checkout, which git ignores:
#      notes                -> <app repository>/.lewitt
#      .claude/agent-memory -> <app repository>/.lewitt/agent-memory
# 5. Turns on the pre-commit check in .githooks/, which blocks a commit that adds
#    a term from notes/denylist.
#
# Usage: scripts/point-at.sh <path to the app repository>
#        scripts/point-at.sh <git URL> <folder to clone into>
set -eu
cd "$(dirname "$0")/.."
case "${1:-}" in
  "") echo "Usage: scripts/point-at.sh <path> | <git URL> <folder>" >&2; exit 1 ;;
  *://*|git@*)
    [ $# -eq 2 ] || { echo "Name the folder to clone $1 into." >&2; exit 1; }
    [ -e "$2" ] || git clone "$1" "$2"
    repo="$2" ;;
  *) repo="$1" ;;
esac
repo="$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)"
repo="$(dirname "$repo")"
mkdir -p "$repo/.lewitt/agent-memory"
[ -e "$repo/.lewitt/denylist" ] || printf '# One term per line. A commit to Lewitt that adds a line containing a term fails.\n' > "$repo/.lewitt/denylist"
exclude="$repo/.git/info/exclude"
mkdir -p "$(dirname "$exclude")"
for pattern in /.lewitt/ /.lewitt-run/; do
  grep -qxF "$pattern" "$exclude" 2>/dev/null || echo "$pattern" >> "$exclude"
done
[ -e lewitt.env ] || cp lewitt.env.example lewitt.env
case "$repo" in "$HOME"/*) value="\$HOME${repo#"$HOME"}" ;; *) value="$repo" ;; esac
here="$(pwd)"
case "$here" in "$HOME"/*) worktrees="\$HOME${here#"$HOME"}/worktrees" ;; *) worktrees="$here/worktrees" ;; esac
python3 - "$value" "$worktrees" <<'PY'
import re, sys
text = open("lewitt.env").read()
def put(name, value, only_if_empty=False):
    global text
    line = f'{name}="{value}"'
    match = re.search(rf"^{name}=(.*)$", text, re.M)
    if not match:
        text += line + "\n"
    elif not only_if_empty or match.group(1).strip('"') == "":
        text = text[:match.start()] + line + text[match.end():]
put("APP_REPO", sys.argv[1])
put("WORKTREES_DIR", sys.argv[2], only_if_empty=True)
open("lewitt.env", "w").write(text)
PY
mkdir -p "$(sh -c 'set -a; . ./lewitt.env; printf %s "$WORKTREES_DIR"')"
for pair in "notes:$repo/.lewitt" ".claude/agent-memory:$repo/.lewitt/agent-memory"; do
  link="${pair%%:*}"
  target="${pair#*:}"
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    echo "$link is a real file or folder. Move its contents into $target, then run this again." >&2
    exit 1
  fi
  ln -sfn "$target" "$link"
done
git config core.hooksPath .githooks
echo "This checkout now points at $repo"
