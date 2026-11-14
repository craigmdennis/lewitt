---
name: start
description: Starts Lewitt in the current folder - summarizes the folder or git repository as it is now, sets up .lewitt/ when it is missing or incomplete, then interviews the design lead about the work and starts the Scope stage. Use when the design lead runs /lewitt:start, asks to set up Lewitt here, or starts a new project in a folder.
disable-model-invocation: true
---

# Start

Run the three parts in order. Ask one question per message, and wait for each answer.

## 1. Summarize the folder

Read the folder before asking anything, and report in a few short lines:

- whether it is a git repository, its default branch, its remote, the latest few commits, and the open worktrees with `git worktree list`;
- what it holds: the stack from its project files, such as `package.json`, `Package.swift`, an `.xcodeproj` or `pyproject.toml`, and its main folders;
- its agent instructions and rule files, such as `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/` or `.claude/`;
- its documents, such as a README, specs, plans and design files, each with one line on what it says;
- uncommitted changes, by file;
- whether `.lewitt/` exists, and which of its files are present.

Read the documents that describe what the product is and what is planned. Report what they decide, in the design lead's own terms. An empty folder gets one line that says so.

## 2. Set up Lewitt

Load the `lewitt:designer` skill. When `.lewitt/` is missing, or its setup check fails, follow `setup.md` in this skill's folder. Its first step runs `scripts/setup.sh`, two folders above this file. When the check passes, say so in one line and skip to part 3.

## 3. Interview and scope

1. Ask what the design lead wants to do, in an open question. Use what part 1 found to make the question specific.
2. Ask the follow-up questions the answer leaves open, one per message, until the problem, the decision the project supports and the one core flow are clear.
3. When documents in the folder already cover the problem, the design, or a stage, show what covers each one, and ask whether it stands. The designer skill's rule on existing work applies.
4. Continue with the Scope stage in the `lewitt:designer` skill: the checks, the questions, `project.md`, `set_project`, and the prior-work check.
