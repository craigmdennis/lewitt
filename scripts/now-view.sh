#!/usr/bin/env bash
# Switch the installed Now view between this checkout and the pushed version.
#
#   scripts/now-view.sh local    # copy plugins/now-view/ from this checkout
#   scripts/now-view.sh live     # fetch the pushed version from GitHub and copy it
#   scripts/now-view.sh status   # say which copy each install holds
#
# Claude Code loads the plugin from the folder that installed_plugins.json names
# for each install, user or project scope. `local` copies this checkout's plugin
# folder into each one and writes .local.json beside plugin.json, with the commit
# it copied. The pane's footer reads that file and shows LOCAL with the commit.
# `live` updates the lewitt marketplace clone, runs `claude plugin update`, and
# copies the marketplace's plugin folder into each install, which removes
# .local.json. The copy takes effect in a session at its next /reload-plugins.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/plugins/now-view"
PLUGINS="$HOME/.claude/plugins"
PLUGIN="now-view@lewitt"

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
    --exclude '.in_use' --exclude '.local.json' --exclude '.claude-plugin/types' \
    "$1/" "$2/"
}

require_installs() {
  if [ -z "$(installs)" ]; then
    echo "$PLUGIN is not installed. Run: claude plugin install $PLUGIN" >&2
    exit 1
  fi
}

case "${1:-status}" in
  local)
    require_installs
    commit="$(git -C "$ROOT" rev-parse --short HEAD)"
    if [ -n "$(git -C "$ROOT" status --porcelain -- plugins/now-view)" ]; then
      commit="$commit+changes"
    fi
    copied="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    installs | while IFS=$'\t' read -r scope path; do
      copy_into "$SRC" "$path"
      printf '{ "source": "local", "commit": "%s", "checkout": "%s", "copiedAt": "%s" }\n' \
        "$commit" "$ROOT" "$copied" > "$path/.local.json"
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
      "$PLUGINS/known_marketplaces.json")/plugins/now-view"
    installs | while IFS=$'\t' read -r scope path; do
      copy_into "$market" "$path"
      rm -f "$path/.local.json"
      echo "$scope: live $(version_of "$path"), in $path"
    done
    echo "Type /reload-plugins in each session that should use it."
    ;;
  status)
    require_installs
    installs | while IFS=$'\t' read -r scope path; do
      if [ -f "$path/.local.json" ]; then
        commit="$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["commit"])' "$path/.local.json")"
        echo "$scope: local $(version_of "$path") at $commit, in $path"
      else
        echo "$scope: live $(version_of "$path"), in $path"
      fi
    done
    echo "Checkout: $(version_of "$SRC") at $(git -C "$ROOT" rev-parse --short HEAD)"
    ;;
  *)
    echo "Usage: scripts/now-view.sh local | live | status" >&2
    exit 2
    ;;
esac
