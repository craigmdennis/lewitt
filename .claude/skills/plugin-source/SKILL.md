---
name: plugin-source
description: Switch an installed plugin of the lewitt marketplace, lewitt or now-view, between this checkout (local) and the version pushed to GitHub (live), or report which one is installed. Use when asked to try a change to Lewitt or the Now view before pushing it, to go back to the live version, or which version is installed.
---

# Plugin source

`scripts/plugin-source.sh` copies a version of a plugin into each install that `~/.claude/plugins/installed_plugins.json` names, at user or project scope.

| Asked for | Run |
|---|---|
| The changes in this checkout, before a push | `scripts/plugin-source.sh <plugin> local` |
| The version pushed to GitHub | `scripts/plugin-source.sh <plugin> live` |
| Which version is installed | `scripts/plugin-source.sh <plugin> status` |

`<plugin>` is `lewitt` or `now-view`.

1. Run the command, and report each line it prints.
2. For `local` and `live`, ask for `/reload-plugins` in each session that should use the copy. A slash command opens its own prompt, so it goes in a message of its own. A change to a hook or an agent takes effect in a new session.
3. A local copy holds `.local-commit`, with the commit it was copied from, and `+changes` when the checkout had uncommitted changes to the plugin. The Now view's footer also shows LOCAL with that commit.

`local` copies files only. It does not commit, push or change the version number. `live` fetches the lewitt marketplace from GitHub, runs `claude plugin update`, and copies the marketplace's version over a local copy that has the same version number.

When the plugin is not installed, the script says so and gives the install command.
