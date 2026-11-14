---
name: resume
description: Reports where a Lewitt project stands after time away - the project, its stage and version, the open questions, the latest decisions and what happens next - from the run folder and git. Use when the design lead runs /lewitt:resume, comes back to a project, or asks where things are.
---

# Resume

1. Find each run folder: `.lewitt-run/` in each worktree that `git worktree list` names, and in the product folder itself for a plain folder. With more than one, list them, latest change first, and ask which one.
2. Read the run folder's `project.md`, `decision-log.md`, `states.md` and the latest version: the newest `prototype/v<n>/`, or the newest commit on the project branch.
3. Read the project branch's commits since the last decision, and its uncommitted changes.
4. Report in this order, a line or two each:
   1. The project and its goal.
   2. The stage and the version.
   3. The latest decisions, each with its date.
   4. The open questions: each flag in the Now view that is still open, and each question the decision log leaves unanswered.
   5. What happens next, and whether it waits on the design lead.
5. Call `set_project` with the name, the goal, the stage and what happens next, so the Now view shows them.
6. Load the `lewitt:designer` skill when it is not loaded yet, and ask the design lead how to continue.
