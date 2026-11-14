#!/bin/sh
# Set up Lewitt in the current folder, where it already is.
#
# The folder's own files and its .gitignore stay unchanged. This script:
#
# 1. Creates .lewitt/ at the root of the folder, or of the main checkout when the
#    folder is in a git repository, with agent-memory/, docs/ and worktrees/.
# 2. Hides .lewitt/ and .lewitt-run/ through the repository's .git/info/exclude.
# 3. Writes .lewitt/paths from the template when it is missing, and sets
#    LEWITT_ROOT and APP_REPO in it.
#
# Running it again changes nothing that is already set up.
#
# Usage: sh <plugin folder>/scripts/setup.sh
set -eu
plugin="$(cd "$(dirname "$0")/.." && pwd)"
if common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
  root="$(dirname "$common")"
  exclude="$common/info/exclude"
  mkdir -p "$(dirname "$exclude")"
  for pattern in /.lewitt/ /.lewitt-run/; do
    grep -qxF "$pattern" "$exclude" 2>/dev/null || echo "$pattern" >> "$exclude"
  done
else
  root="$(pwd)"
fi
mkdir -p "$root/.lewitt/agent-memory" "$root/.lewitt/docs" "$root/.lewitt/worktrees"
[ -e "$root/.lewitt/paths" ] || cp "$plugin/templates/paths" "$root/.lewitt/paths"
python3 -I - "$root/.lewitt/paths" "$plugin" "$root" "$HOME" <<'PY'
import re, sys
path, plugin, root, home = sys.argv[1:]
def rel(value):
    return "$HOME" + value[len(home):] if value == home or value.startswith(home + "/") else value
text = open(path).read()
for name, value in (("LEWITT_ROOT", rel(plugin)), ("APP_REPO", rel(root))):
    line = f'{name}="{value}"'
    if re.search(rf"^{name}=", text, re.M):
        text = re.sub(rf"^{name}=.*$", lambda _: line, text, count=1, flags=re.M)
    else:
        text += line + "\n"
open(path, "w").write(text)
PY
echo "Lewitt is set up in $root"
