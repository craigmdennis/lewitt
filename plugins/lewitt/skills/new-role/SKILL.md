---
name: new-role
description: Makes a new sub-agent role for this product during a project - interviews the design lead about the job, researches current expert practice and the tools' primary documentation on the web, and writes the agent and its skill into the product's .claude/ folder. Use when the design lead runs /lewitt:new-role, or a project needs a role neither Lewitt nor the product has.
---

# New role

A role made here lives in the product's `.claude/agents/` and `.claude/skills/`, and only this product loads it. `/lewitt:contribute` copies a role into Lewitt in general terms when it proves useful beyond the product.

## 1. Interview

Ask one question per message:

1. The job: what the role does for the team, and which stage it serves.
2. The stack and the tools it works with, with versions when the repository names them.
3. Its tasks, each as a brief the designer would send.
4. What it writes: its memory only, or its memory and the project's worktrees.
5. What it must never do, beyond pushing and writing to GitHub, which Lewitt blocks for every role.

Propose answers from the repository and the project where you can, and ask the design lead to confirm or correct them.

## 2. Research

Gather the knowledge the role needs to work as an expert:

- With a researcher in `.lewitt/roles.md`, brief it with the role's job, stack and tasks, and ask for current practice, the primary documentation of each tool, common mistakes, and how an expert checks the work.
- Otherwise, search the web directly with WebSearch and read the pages with WebFetch, or with the `web-fetch` agent where this session has no WebFetch tool.

Prefer each tool's own documentation and source over articles about it, and note the version each source covers. Keep each source's URL.

## 3. Write the role

1. Write `.claude/agents/<role>.md`, with the sections of Lewitt's built-in roles in `$LEWITT_ROOT/agents/`: the frontmatter, what it writes, its tasks, its reply and its memory. Set `model: sonnet` unless the design lead asks for another. Its memory file is `.lewitt/agent-memory/<role>/MEMORY.md`.
2. Write `.claude/skills/<skill>/SKILL.md` with the expert knowledge from the research: the practice, the commands, the checks and the mistakes to avoid, with the sources at the end. List the skill under `skills:` in the agent's frontmatter.
3. Add a row to `.lewitt/roles.md`, with the agent type and the "Writes" column, and the skill under the role's heading in `.lewitt/skills.md`.
4. Add `/.claude/agents/<role>.md` and `/.claude/skills/<skill>/` to the repository's `.git/info/exclude`.
5. Record the new role in the decision log of the current project.

## 4. Load it

Ask the design lead to open `/agents`, or to start a new session, when the agent list does not show the role yet. Then brief it with its first task.
