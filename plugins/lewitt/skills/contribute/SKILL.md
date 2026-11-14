---
name: contribute
description: Copies a role, a skill, a rule or a change to the way of working from this product into Lewitt's source repository, rewritten in general terms with no company content, as a commit for the owner to approve. Use when the design lead runs /lewitt:contribute, or asks to add something from a project to Lewitt.
disable-model-invocation: true
---

# Contribute

Lewitt's repository is public. A contribution states the way of working in general terms, with no name, path, term or example from the product it came from.

1. **Name it.** Ask what to contribute: a role from `.claude/agents/`, a skill from `.claude/skills/`, a pattern rule, or a change to a stage, a brief or a guide. Read it.
2. **Find the source checkout.** Look for a folder named `lewitt` beside the product folder, then in the folder that holds the design lead's other repositories, and check that its `origin` is the Lewitt repository. When none is found, ask for its path, or offer to clone it.
3. **Check the checkout.** Run `git -C <checkout> status --short` and `git -C <checkout> pull --ff-only`. Stop and report when it has uncommitted changes of its own.
4. **Rewrite it in general terms.** Replace each product name, company term, internal host, path and example with a general one. Keep the reasoning and the steps.
5. **Check the denylist.** When `$HOME/.config/lewitt/denylist` exists, read it, and search the rewritten text for each term, ignoring case. Reword each match. Show the design lead the rewritten text.
6. **Write it into the checkout:**
   - A role goes in `plugins/lewitt/agents/<role>.md`, with its memory at `.lewitt/agent-memory/<role>/MEMORY.md`. Add it to `BUILT_IN` in `plugins/lewitt/hooks/scope.py` with the folders it writes, to the roles table in `plugins/lewitt/skills/designer/SKILL.md` and `README.md`, to `plugins/lewitt/templates/roles.md`, and a heading for it to `plugins/lewitt/templates/skills.md`. When it is an engineer, add the files that suggest it to the "Roles" step of `plugins/lewitt/skills/start/setup.md`.
   - A skill goes in `plugins/lewitt/skills/<skill>/SKILL.md`. Rename `skills:` entries that name it to `lewitt:<skill>`.
   - A rule or a change to the way of working goes in the file that covers it, most often `plugins/lewitt/skills/designer/SKILL.md` or a guide.
7. **Version.** Raise the patch version in `plugins/lewitt/.claude-plugin/plugin.json`.
8. **Verify.** Run `python3 plugins/lewitt/hooks/test_hooks.py` and `claude plugin validate plugins/lewitt` in the checkout.
9. **Commit.** Commit the change on its own, with the files of that change only. The checkout's pre-commit check reads the same denylist. Ask the design lead before pushing.

Others contribute through a pull request to the Lewitt repository on GitHub.
