# Lewitt

A product design team in Claude Code. The design lead works live with the designer, who is the main Claude Code session. The designer hands copy, research and engineering to sub-agents. `CLAUDE.md` holds the guidelines for this way of working.

The name comes from Sol LeWitt, whose wall drawings were written instructions that other people drew.

## Goals

Lewitt replaces an earlier setup that ran design projects through an orchestration agent on a task board. These goals come from what that setup did well and what it did badly:

1. **The design lead stays in the design conversation.** Feedback relayed through an orchestration agent loses detail in both directions. In Lewitt the design lead talks to the designer directly, as in a Claude Code session, and gives direction while the work happens.
2. **Bounded tasks go to specialists.** Research, copy and front-end work come back usable after a light review. Each one is a sub-agent here, with its own skills and memory, so the designer's context stays small.
3. **The prototype is the feedback target.** A prototype with every state reachable by URL is the most useful output. Each version is one prototype link, and renders and diagrams are made only on request.
4. **Lower cost.** Lewitt has no orchestration agent, runs Opus for the designer only, and runs every sub-agent on Sonnet.
5. **Visibility without a task board.** The design lead can see each sub-agent's task, its brief and its answer in the Now view.
6. **Less upkeep.** Lewitt runs on Claude Code alone, with no server and no local patches.
7. **Each agent keeps what it learns.** Each sub-agent has a memory file that persists across sessions and projects.

## Roles

| Role | Runs as | Model | Does | Writes |
|---|---|---|---|---|
| Design lead | The person | | Directs the design, chooses between options, approves each stage, and gives feedback | |
| Designer | The main session | Opus | Talks with the design lead, scopes the project, writes the states, brings options, builds the prototype, applies copy, records decisions and rules, and opens pull requests after approval | The run folder, the guides |
| Copywriter | Sub-agent `copywriter` | Sonnet | Writes and reviews each UI string, with the rule or existing string it follows | Its memory |
| Researcher | Sub-agent `researcher` | Sonnet | Finds the evidence for a design decision in the web, Mobbin, Amplitude, a data warehouse, Notion and Linear, and rates its confidence in each finding | Its memory |
| Front-end engineer | Sub-agent `frontend-engineer` | Sonnet | Writes the codebase report and the state inventory, makes each state reachable by URL, answers feasibility questions, builds the final version and the design system work, and prepares the pull requests | The project's worktree, its files in the run folder, its memory |
| Designer fork | Sub-agent `fork` | Opus | Builds a second option or a separate exploration with the designer's context | What the designer's brief names |

A full-stack engineer for backend changes is planned.

Two hooks hold each sub-agent to its column:

- `memory-only-writes.py` blocks a write or an edit outside the sub-agent's memory and the folders its definition names.
- `no-remote-writes.py` blocks the front-end engineer's pushes and GitHub writes. The engineer returns those commands, and the designer runs them after the design lead approves.

## The Now view

`plugins/now-view/` is a Claude Code mod. It adds a pane beside the chat:

- **Working:** each running sub-agent, its task, when it started and its latest tool call.
- **Finished:** each finished sub-agent, whether it finished, stopped or failed, and how long it took.
- Selecting a run shows its brief and its answer. `b` returns to the list.

The pane opens when a sub-agent starts, and `/now` opens it at any time. The pane lists the runs of the current session. The terminal's font is the pane's font.

Install it from this repository:

```
/plugin marketplace add craigmdennis/lewitt
/plugin install now-view@lewitt
```

Run its test with `claude plugin test plugins/now-view`.

## Contents

| Path | Content |
|---|---|
| `CLAUDE.md` | The designer's guidelines: roles, stages, the prototype, briefs, pull requests, memory and rules |
| `.claude/agents/` | The sub-agent roles: `copywriter.md`, `researcher.md` and `frontend-engineer.md` |
| `.claude/skills/` | `copy-rules` for the copywriter, `research-methods` for the researcher |
| `.claude/hooks/` | `memory-only-writes.py` and `no-remote-writes.py` |
| `.claude/agent-memory/` | Each sub-agent's memory, `<role>/MEMORY.md`. Ignored by git |
| `guides/` | Usability, visual design and UX writing principles |
| `FIRST-RUN.md` | The setup the designer runs when `machine.env` or a company guide is missing |
| `templates/company/` | The company guides the first run fills in: the app, the design system, copy sources, research sources and pattern rules |
| `plugins/now-view/` | The Now view |
| `scripts/` | Prototype build, session and screenshot scripts |
| `company/`, `runs/`, `worktrees/` | The company guides, one folder per project, and the app worktrees. Ignored by git, because they hold the company's data |

## Setup

1. Install the Now view, as above.
2. Open Claude Code in this repository. The designer finds that `machine.env` and `company/` are missing, and follows `FIRST-RUN.md`: it reads the app repository, proposes each answer, and asks one question at a time. It writes `machine.env` and the company guides in `company/` from `templates/company/`.

To change an answer later, edit its file in `company/` or `machine.env`. To run the setup again, delete the file and start a new session.

The researcher and the front-end engineer read Amplitude, Mobbin, Linear, Notion and a Snowflake server named `snowflake`. Each one is optional, and each one is read only. The first run reports which ones are connected.

## Starting a project

Open Claude Code in this repository and describe the project. The designer writes `runs/<project>/project.md` and asks the design lead to approve the scope before anything else.
