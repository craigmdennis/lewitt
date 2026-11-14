---
name: now-view-source
description: Switch the installed Now view between this checkout (local) and the version pushed to GitHub (live), or report which one is installed. Use when the design lead asks to try a change to the Now view before pushing it, to go back to the live version, or which version the pane runs.
---

# Now view source

`scripts/now-view.sh` copies a version of the Now view into each install that `~/.claude/plugins/installed_plugins.json` names, at user or project scope. A session loads the copy at its next `/reload-plugins`.

| The design lead asks for | Run |
|---|---|
| The changes in this checkout, before a push | `scripts/now-view.sh local` |
| The version pushed to GitHub | `scripts/now-view.sh live` |
| Which version is installed | `scripts/now-view.sh status` |

1. Run the command, and report each line it prints.
2. For `local` and `live`, ask the design lead to type `/reload-plugins` in each session that should use the copy. A slash command opens its own prompt, so it goes in a message of its own.
3. The pane's footer shows the version. A local copy also shows LOCAL with the commit it was copied from, and `+changes` when the checkout had uncommitted changes to `plugins/now-view/`. The script writes that commit into the copy's `hooks/build.ts`.

`local` copies files only. It does not commit, push or change the version number. `live` fetches the lewitt marketplace from GitHub, runs `claude plugin update`, and copies the marketplace's version over a local copy that has the same version number.

When the plugin is not installed, the script says so. Install it as "The Now view" in `CLAUDE.md` describes.
