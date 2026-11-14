## Roles

The roles this product uses. The setup saves this list as `.lewitt/roles.md` and deletes each role the product does not use. The designer briefs only the roles listed here.

A built-in role's definition is in Lewitt's `agents/` folder, and its agent type starts with `lewitt:`. A role made for this product with `/lewitt:new-role` is in the product's `.claude/agents/`, and its agent type is its file name.

"Writes" names the folders the role may write: `memory` is `.lewitt/agent-memory/<role>/`, and `worktrees` is the folder `WORKTREES_DIR` names in `.lewitt/paths`. Lewitt's hook enforces it, and blocks pushes and GitHub writes for every role listed here.

| Role | Agent type | Writes |
|---|---|---|
| Designer | The main session, in every product | |
| Design partner | `fork`, in every product | |
| Copywriter | `lewitt:copywriter` | memory |
| Researcher | `lewitt:researcher` | memory |
| Front-end engineer | `lewitt:frontend-engineer` | memory, worktrees |
| macOS engineer | `lewitt:macos-engineer` | memory, worktrees |
