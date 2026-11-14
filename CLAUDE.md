# Working on Lewitt

This repository is the source of Lewitt, a product design team in Claude Code, and the marketplace that installs it. A session in this checkout changes Lewitt itself. A product's work happens in the product's own folder, where the installed `lewitt` plugin runs.

## What is where

| Path | Holds |
|---|---|
| `.claude-plugin/marketplace.json` | The `lewitt` marketplace, with its two plugins |
| `plugins/lewitt/` | The `lewitt` plugin |
| `plugins/lewitt/skills/designer/SKILL.md` | The designer's way of working: stages, briefs, the prototype, rules and memory |
| `plugins/lewitt/skills/start/` | `/lewitt:start`, with `setup.md`, the questions that set Lewitt up in a product |
| `plugins/lewitt/skills/{resume,new-role,contribute}/` | The other commands |
| `plugins/lewitt/skills/{copy-rules,research-methods,libghostty}/` | Skills the roles load |
| `plugins/lewitt/agents/` | The built-in roles |
| `plugins/lewitt/hooks/` | `session-start.py`, `scope.py` and their test |
| `plugins/lewitt/guides/`, `templates/`, `scripts/` | General guides, the templates of a product's `.lewitt/` notes, and the scripts the roles run |
| `plugins/now-view/` | The Now view pane, a Claude Code mod |
| `scripts/plugin-source.sh` | Switches an installed plugin between this checkout and GitHub |
| `docs/` | Specs and plans for changes to Lewitt. Git ignores it. |

## Rules for a change

- The repository is public. Write every change in general terms, with no name, path, term or example from a product. The pre-commit check blocks a commit that adds a term from `$HOME/.config/lewitt/denylist`. Turn the check on once per checkout with `git config core.hooksPath .githooks`.
- Commit each change on its own, with the files of that change only, and ask before pushing.
- Raise the version in `plugins/<plugin>/.claude-plugin/plugin.json` for each change that should reach installs. For the Now view, set the same version in `plugins/now-view/hooks/build.ts`. The pre-commit check compares the two.
- A new built-in role follows the steps of `/lewitt:contribute`, in `plugins/lewitt/skills/contribute/SKILL.md`.
- No emoji. Documentation uses third-person impersonal prose.

## Checks

- `python3 plugins/lewitt/hooks/test_hooks.py`
- `claude plugin validate plugins/lewitt` and `claude plugin validate plugins/now-view`
- `claude plugin test plugins/now-view`

## Trying a change before a push

`scripts/plugin-source.sh <plugin> local` copies this checkout's plugin over each install, and `live` puts the pushed version back. The `plugin-source` skill runs it.
