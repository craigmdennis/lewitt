# Lewitt

A product design team in Claude Code, installed as a plugin. The design lead works live with the designer, who is the main Claude Code session. The designer hands copy, research and engineering to sub-agents. Lewitt runs in the product's own folder: set it up once with `/lewitt:start`, and every later session there starts as the designer.

The name comes from Sol LeWitt, whose wall drawings were written instructions that other people drew.

## Goals

Lewitt replaces an earlier setup that ran design projects through an orchestration agent on a task board. These goals come from what that setup did well and what it did badly:

1. **The design lead stays in the design conversation.** Feedback relayed through an orchestration agent loses detail in both directions. In Lewitt the design lead talks to the designer directly, as in a Claude Code session, and gives direction while the work happens.
2. **Bounded tasks go to specialists.** Research, copy and engineering work come back usable after a light review. Each one is a sub-agent here, with its own skills and memory, so the designer's context stays small.
3. **The prototype is the feedback target.** A prototype with every state reachable by URL is the most useful output. Each version is one prototype link, and renders and diagrams are made only on request.
4. **Lower cost.** Lewitt has no orchestration agent, runs Opus for the designer only, and runs every sub-agent on Sonnet.
5. **Visibility without a task board.** The design lead can see each sub-agent's task, its brief and its answer in the Now view.
6. **Less upkeep.** Lewitt runs on Claude Code alone, with no server and no local patches.
7. **Each agent keeps what it learns.** Each sub-agent has a memory file that persists across sessions and projects.

## Install

Run each command in a terminal, once per Mac:

```sh
claude plugin marketplace add craigmdennis/lewitt
claude plugin install lewitt@lewitt
```

The `lewitt` plugin depends on `now-view`, so the second command installs the Now view too. Both install at user scope, so every session loads them, and `claude plugin update` brings each new version.

## Use

1. Open Claude Code in the product's folder, a git repository or a plain folder: `claude`.
2. In a folder Lewitt has not set up, run `/lewitt:start`. It summarizes the folder, sets up `.lewitt/` with one question at a time, then asks what you want to do and scopes the first project.
3. In a folder Lewitt has set up, start Claude Code the usual way. The session-start hook makes the session the designer, with each project in progress in its context.

| Command | Does |
|---|---|
| `/lewitt:start` | Summarizes the folder, sets up `.lewitt/` when it is missing or incomplete, and starts a project |
| `/lewitt:resume` | Reports the project, its stage, the open questions and what happens next, after time away |
| `/lewitt:new-role` | Makes a role for this product, with expert knowledge researched on the web, in the product's `.claude/` |
| `/lewitt:contribute` | Copies a role, a skill or a rule from the product into Lewitt's source repository, in general terms |
| `/now` | Opens the Now view. `/now clear` removes the project's finished tasks |

The researcher and the engineers read Amplitude, Mobbin, Linear, Notion and a Snowflake server named `snowflake`, through the servers connected in your own Claude Code configuration. Each one is optional, and each one is read only. The setup reports which ones are connected.

## Roles

| Role | Runs as | Model | Does | Writes |
|---|---|---|---|---|
| Design lead | The person | | Directs the design, chooses between options, approves each stage, and gives feedback | |
| Designer | The main session | Opus | Talks with the design lead, scopes the project, writes the states, brings options, builds the prototype, applies copy, records decisions and rules, and opens pull requests after approval | The run folder, `.lewitt/` |
| Copywriter | Sub-agent `lewitt:copywriter` | Sonnet | Writes and reviews each UI string, with the rule or existing string it follows | Its memory |
| Researcher | Sub-agent `lewitt:researcher` | Sonnet | Finds the evidence for a design decision in the web, Mobbin, Amplitude, a data warehouse, Notion and Linear, and rates its confidence in each finding | Its memory |
| Front-end engineer | Sub-agent `lewitt:frontend-engineer` | Sonnet | Writes the codebase report and the state inventory, makes each state reachable by URL, answers feasibility questions, builds the final version and the design system work, and prepares the pull requests | The project's worktree, its files in the run folder, its memory |
| macOS engineer | Sub-agent `lewitt:macos-engineer` | Sonnet | For a native Mac app: writes the codebase report and the state inventory, makes each state reachable by a launch argument, answers feasibility questions, builds the final version in Swift and SwiftUI, and prepares the pull requests | The project's worktree, its files in the run folder, its memory |
| Design partner | Sub-agent `fork` | Opus | Builds a second option or a separate exploration with the designer's context | What the designer's brief names |

A full-stack engineer for backend changes is planned.

Each product uses the roles listed in its `.lewitt/roles.md`, which the setup writes. The design lead, the designer and the design partner are in every product. The built-in roles appear in every session's agent list, and the designer briefs only the ones a product lists. A role made with `/lewitt:new-role` is in the product's `.claude/agents/`, and only that product loads it.

One plugin hook, `scope.py`, holds each role to its column. It blocks a write or an edit outside the role's memory and, for an engineer, the project's worktrees. It also blocks each role's pushes and GitHub writes: the engineer returns those commands, and the designer runs them after the design lead approves.

## The Now view

`plugins/now-view/` is a Claude Code mod. It adds a pane beside the chat:

- **Needs you:** at the top, each question the designer flagged for the design lead, with the task it comes from. The designer flags a question with the `flag_for_design_lead` tool, and the design lead gets a notification. The design lead answers in the chat. The designer's `resolve_flag` call, or "Done" in the pane, clears it. With no open question, the band reads "NOTHING NEEDS YOU".
- **Running:** a card for each task in progress, or "Nothing is running.": the team member's role, the task, a turning mark with the time since the task started, what it is doing now in plain words, and a link to each file it changed. The NOW line is the description the team member gave its latest step, or what that step does to which file. While the designer works on a request in the chat, the DESIGNER card comes first, with the request as its task.
- **Finished:** a row for each finished sub-agent: whether it finished, stopped or failed, how long it took, the task, and a link to each Markdown file it wrote, such as a review or a report. A request to the designer is listed too when the designer changed a file, gave the team a task or flagged a question while working on it, with a count of each. A request the designer only answered in the chat is left out.
- The footer, at the bottom of the pane, shows the version. A copy made from a checkout also shows LOCAL with the commit it came from.
- Selecting a task opens it: its status, the files it changed, its brief from the designer and its answer. `t` opens the run's transcript, and `b` returns to the list.

The pane opens when a sub-agent starts, and `/now` opens it at any time. `/now clear` removes the project's finished tasks from the pane and from its stored history, and keeps the running tasks and the open questions. The pane lists the project's tasks: those of the current chat, and those of earlier chats in the same project folder, which it keeps in Claude Code's plugin store. It names each task by its team role, such as COPYWRITER, RESEARCHER or DESIGN PARTNER. The terminal's font is the pane's font.

Installing Lewitt installs it. In a session that started before the install, type `/reload-plugins`, then `/now`.

The pane also lists the sub-agents that started before `/reload-plugins`, from the session's transcript. A run that finished earlier shows how long it took. A run still working shows the time the pane first saw it, because its start time is not recorded.

Run its test with `claude plugin test plugins/now-view`.

To try a change to the pane before pushing it, run `scripts/plugin-source.sh now-view local`, then type `/reload-plugins`. The pane's footer then shows LOCAL with the commit it was copied from. `live` puts the version pushed to GitHub back, and `status` says which one is installed.

## Where things live

Lewitt works with the product's folder where it already is. This repository holds only the way of working.

| What | Where |
|---|---|
| The notes about the product: the roles, the app, the design system guidance, copy and research sources, pattern rules, company skills and agent memory | `.lewitt/` in the product's main checkout |
| The pointers for this Mac: the plugin's folder, the worktrees folder, the backend repository, Playwright and the session file | `.lewitt/paths` |
| The product's worktrees, one per project | `.lewitt/worktrees/` by default, or a folder the repository already uses, set as `WORKTREES_DIR` |
| One project's files: scope, states, decision log, research, screenshots and the standalone prototype | `.lewitt-run/` in the project's worktree |
| Roles and skills made for the product | `.claude/agents/` and `.claude/skills/` in the product |
| Code | A branch in the project's worktree, shipped as a pull request |
| Company terms kept out of this repository | `$HOME/.config/lewitt/denylist` |

The setup adds `.lewitt/`, `.lewitt-run/` and each role it makes to the repository's `.git/info/exclude`. Git ignores them, and the repository's tracked files and its `.gitignore` stay unchanged.

## Working on Lewitt

`CLAUDE.md` in this repository covers changing Lewitt itself: where each part is, the rules for a change, the checks, and `scripts/plugin-source.sh` for trying a change before a push.
