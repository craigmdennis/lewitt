#!/usr/bin/env bash
# Switch an installed plugin of this marketplace between this checkout and the
# pushed version.
#
#   scripts/plugin-source.sh <plugin> local    # copy plugins/<plugin>/ from this checkout
#   scripts/plugin-source.sh <plugin> live     # fetch the pushed version from GitHub and copy it
#   scripts/plugin-source.sh <plugin> status   # say which copy each install holds
#
# <plugin> is lewitt or now-view. Claude Code loads a plugin from the folder that
# installed_plugins.json names for each install, user or project scope. `local`
# copies this checkout's plugin folder into each one, and records the commit it
# copied in the copy's .local-commit file. For the Now view it also sets LOCAL in
# the copy's hooks/build.ts, which the pane's footer shows. `live` updates the
# lewitt marketplace clone, runs `claude plugin update`, and copies the
# marketplace's plugin folder into each install, which removes .local-commit and
# puts back the pushed hooks/build.ts. A copy takes effect in a session at its
# next /reload-plugins, and a hook or an agent change at the next session.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:-}"
case "$NAME" in
  lewitt|now-view) ;;
  *) echo "Usage: scripts/plugin-source.sh lewitt|now-view local|live|status" >&2; exit 2 ;;
esac
SRC="$ROOT/plugins/$NAME"
PLUGINS="$HOME/.claude/plugins"
PLUGIN="$NAME@lewitt"

# Each install's scope and folder, one per line, as "scope<TAB>path".
installs() {
  python3 -I - "$PLUGINS/installed_plugins.json" "$PLUGIN" <<'EOF'
import json, sys
data = json.load(open(sys.argv[1]))
for record in data.get("plugins", {}).get(sys.argv[2], []):
    print(f"{record['scope']}\t{record['installPath']}")
EOF
}

# The version in a plugin folder's plugin.json.
version_of() {
  python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1])).get("version", "?"))' \
    "$1/.claude-plugin/plugin.json"
}

# Copies a plugin folder into an install, keeping the engine's own files.
copy_into() {
  rsync -a --delete \
    --exclude '.in_use' --exclude '.claude-plugin/types' \
    "$1/" "$2/"
}

require_installs() {
  if [ -z "$(installs)" ]; then
    echo "$PLUGIN is not installed. Run: claude plugin install $PLUGIN" >&2
    exit 1
  fi
}

case "${2:-status}" in
  local)
    require_installs
    commit="$(git -C "$ROOT" rev-parse --short HEAD)"
    if [ -n "$(git -C "$ROOT" status --porcelain -- "plugins/$NAME")" ]; then
      commit="$commit+changes"
    fi
    installs | while IFS=$'\t' read -r scope path; do
      copy_into "$SRC" "$path"
      echo "$commit" > "$path/.local-commit"
      if [ -f "$path/hooks/build.ts" ]; then
        sed -i '' "s/^export const LOCAL.*/export const LOCAL: string | undefined = '$commit'/" \
          "$path/hooks/build.ts"
      fi
      echo "$scope: local $(version_of "$path") at $commit, in $path"
    done
    echo "Type /reload-plugins in each session that should use it."
    ;;
  live)
    require_installs
    claude plugin marketplace update lewitt >/dev/null
    installs | while IFS=$'\t' read -r scope _; do
      claude plugin update "$PLUGIN" --scope "$scope" >/dev/null
    done
    market="$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["lewitt"]["installLocation"])' \
      "$PLUGINS/known_marketplaces.json")/plugins/$NAME"
    installs | while IFS=$'\t' read -r scope path; do
      copy_into "$market" "$path"
      echo "$scope: pushed $(version_of "$path"), in $path"
    done
    echo "Type /reload-plugins in each session that should use it."
    ;;
  status)
    require_installs
    installs | while IFS=$'\t' read -r scope path; do
      if [ -f "$path/.local-commit" ]; then
        echo "$scope: local $(version_of "$path") at $(cat "$path/.local-commit"), in $path"
      else
        echo "$scope: pushed $(version_of "$path"), in $path"
      fi
    done
    echo "Checkout: $(version_of "$SRC") at $(git -C "$ROOT" rev-parse --short HEAD)"
    ;;
  *)
    echo "Usage: scripts/plugin-source.sh lewitt|now-view local|live|status" >&2
    exit 2
    ;;
esac
