import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Flag, Project, Run, RunStatus } from '../types'
import { LOCAL, VERSION } from './build'

const PANE = 'now-view'
const TITLE = 'Now'
const RECENT = 3
const CHANGED = 6
const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SHOWN = 12
// The tasks kept for a project across chats, and the most of a brief or an
// answer kept with each, so the store stays well under its 4 MiB.
const HISTORY = 100
const KEPT = 4000
const LABEL = 9
const DESIGNER = 'designer'
// Change the tag when a run's fields change in a way an earlier value cannot
// meet: it declines what an earlier version stored, which outlives a reload.
// The fields added since runs-1 are optional, so its values still read.
const runs = atom({ plugin: 'now-view', key: 'runs' } as const, [], {
  shape: 'runs-1',
})
const flags = atom({ plugin: 'now-view', key: 'flags' } as const, [], { shape: 'flags-1' })
const selected = atom({ plugin: 'now-view', key: 'selected' } as const, null)
const project = atom({ plugin: 'now-view', key: 'project' } as const, null, { shape: 'project-1' })
// The projects kept for a folder: the latest for each chat, at most this many.
const PROJECTS = 20

// The tools the designer calls to flag a question for the design lead, and to
// clear the flag once the design lead answers it.
const FLAG_TOOL = 'mcp__now-view__flag_for_design_lead'
const RESOLVE_TOOL = 'mcp__now-view__resolve_flag'
const PROJECT_TOOL = 'mcp__now-view__set_project'

// The ids already looked up in the session's agent list, so a run the list
// does not hold, such as a workflow's, is looked up once.
const looked = new Set<string>()

// The chat this session is, and the store key of its project's tasks. A reload
// and a new chat each run session.start, which sets both again.
let sessionId: string | undefined
let storeKey: string | undefined
let flagsKey: string | undefined
let projectKey: string | undefined

// The team's names for the agent types the designer gives tasks to.
const ROLE: Record<string, string> = {
  copywriter: 'COPYWRITER',
  researcher: 'RESEARCHER',
  'frontend-engineer': 'FRONT-END ENGINEER',
  [DESIGNER]: 'DESIGNER',
  fork: 'DESIGN PARTNER',
  'general-purpose': 'TEAM MEMBER',
  Explore: 'RESEARCH ASSISTANT',
  Plan: 'PLANNER',
}

function role(type: string): string {
  return ROLE[type] ?? (type.split(':').at(-1) ?? type).replace(/[-_]/g, ' ').toUpperCase()
}

// What the pane needs of an agent, from the session's agent list or from an
// Agent call in the main transcript.
type Found = { id: string; type: string; description: string; status: RunStatus }

// A tool call in plain words: the description the caller gave it, or what
// the tool does to what, without the tool's name.
function step(e: { tool: string }): string {
  const input = e as unknown as Record<string, unknown>
  const text = (field: string) => {
    const value = input[field]

    return typeof value === 'string' && value.trim() ? (value.split('\n')[0] ?? '').trim() : undefined
  }
  const name = (field: string) => text(field)?.split('/').filter(Boolean).at(-1)
  const said = text('description')
  if (said) return said.length > 120 ? `${said.slice(0, 119)}…` : said
  if (e.tool === FLAG_TOOL) return 'Flagging a question for you'
  if (e.tool === RESOLVE_TOOL) return 'Clearing an answered question'
  if (e.tool === PROJECT_TOOL) return 'Updating the project summary'
  if (e.tool.startsWith('mcp__')) {
    const service = (e.tool.split('__')[1] ?? '')
      .replace(/^(claude_ai_|plugin_[^_]+_)/, '')
      .replace(/[-_]/g, ' ')
    const query = text('query') ?? text('pattern')

    return query ? `Searching ${service} for "${query}"` : `Using ${service}`
  }
  switch (e.tool) {
    case 'Read':
      return `Reading ${name('file_path') ?? 'a file'}`
    case 'Write':
      return `Writing ${name('file_path') ?? 'a file'}`
    case 'Edit':
    case 'MultiEdit':
      return `Editing ${name('file_path') ?? 'a file'}`
    case 'NotebookEdit':
      return `Editing ${name('notebook_path') ?? 'a notebook'}`
    case 'Grep':
      return `Searching the code for "${text('pattern') ?? ''}"`
    case 'Glob':
      return `Finding files named ${text('pattern') ?? ''}`
    case 'WebSearch':
      return `Searching the web for "${text('query') ?? ''}"`
    case 'WebFetch':
      return `Reading ${(text('url') ?? 'a web page').replace(/^https?:\/\//, '').split('/')[0]}`
    case 'Skill':
      return `Following the ${text('skill') ?? ''} skill`
    case 'Bash':
      return 'Running a command'
    case 'Agent':
      return 'Giving a task to the team'
    default:
      return `Using ${e.tool}`
  }
}

function clockTime(ms: number): string {
  const time = new Date(ms)

  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// The time on the day it happened, or the date on an earlier day.
function stamp(ms: number, now: number): string {
  const when = new Date(ms)

  return when.toDateString() === new Date(now).toDateString()
    ? clockTime(ms)
    : `${MONTHS[when.getMonth()]} ${when.getDate()}`
}

function duration(ms: number): string {
  const minutes = Math.round(ms / 60000)

  return minutes < 1 ? `${Math.round(ms / 1000)} SEC` : `${minutes} MIN`
}

// Text in exactly `count` lines of at most `columns` characters, broken at
// spaces, the last line ending in "…" when the text is longer.
function fixedLines(text: string, columns: number, count: number): string[] {
  const lines: string[] = []
  let rest = text.replace(/\s+/g, ' ').trim()
  while (lines.length < count && rest.length > 0) {
    if (rest.length <= columns) {
      lines.push(rest)
      rest = ''
      break
    }
    const last = lines.length === count - 1
    const room = last ? columns - 1 : columns
    const space = rest.lastIndexOf(' ', room)
    const cut = space > 0 ? space : room
    lines.push(last ? `${rest.slice(0, cut).trimEnd()}…` : rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  while (lines.length < count) lines.push('')

  return lines
}

// Whether a designer turn produced work the chat does not show on its own: a
// file it changed, a task it gave the team or a question it flagged. Only
// those turns are kept and listed as finished.
function produced(run: Run): boolean {
  return (
    (run.changed?.length ?? 0) > 0 || (run.spawned?.length ?? 0) > 0 || (run.flagged ?? 0) > 0
  )
}

// A list of things in plain words: "a", "a and b", "a, b and c".
function listed(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

function firstLine(text: string): string {
  return (text.split('\n').find(line => line.trim().length > 0) ?? '').replace(/^[#>*\-\s]+/, '')
}

// What a designer turn did: the first line of its answer, or else its last
// step. The design lead wrote the request, so the pane does not repeat it.
function didWhat(run: Run): string {
  const said = run.answer ? firstLine(run.answer).replace(/\*\*/g, '') : ''
  if (said) return said.length > 160 ? `${said.slice(0, 159)}…` : said

  return run.lastTool ?? 'Answered in the chat'
}

const STATUS: Record<RunStatus, string> = {
  running: 'IN PROGRESS',
  done: 'FINISHED',
  stopped: 'STOPPED',
  failed: 'FAILED',
}

// How a finished run ended, with how long it took when that is known.
function outcome(run: Run): string {
  const took =
    run.durationMs !== undefined
      ? run.durationMs
      : run.endedAt && !run.seenLate
        ? run.endedAt - run.startedAt
        : undefined
  if (took === undefined) return STATUS[run.status]

  return run.status === 'done' ? `FINISHED IN ${duration(took)}` : `${STATUS[run.status]} AFTER ${duration(took)}`
}

// What the designer is working on, from the text that started its turn: the
// design lead's request, or a team member's answer the designer reads.
function request(text: string): string {
  if (!text.trim()) return 'Continuing its work'
  if (text.includes('<task-notification')) {
    const summary = /<summary>([\s\S]*?)<\/summary>/.exec(text)?.[1]?.trim()

    return summary ? `Reading a result: ${summary}` : "Reading a team member's answer"
  }
  const line = firstLine(text)

  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

const NO_ANSWER: Record<RunStatus, string> = {
  running: 'No answer yet. The task is still in progress.',
  done: 'The task finished without an answer.',
  stopped: 'No answer. The task was stopped before it finished.',
  failed: 'No answer. The task failed before it finished.',
}

function statusOf(agent: AgentInfo): RunStatus {
  if (agent.status === 'completed') return 'done'
  if (agent.status === 'failed') return 'failed'
  if (agent.status === 'killed') return 'stopped'

  return 'running'
}

// A run that started before the plugin loaded: its brief, tool calls and
// answer from its own transcript.
async function adopt(
  $: EngineInterface,
  found: Found,
  extra: { brief?: string; durationMs?: number },
): Promise<void> {
  const read = await $.session.messages({ agentId: found.id })
  const messages = Array.isArray(read) ? read : []
  const uses = messages.flatMap(one => (one.role === 'assistant' ? one.toolUses : []))
  const calls = uses.map(use => step({ ...use.input, tool: use.tool }))
  const run: Run = {
    id: found.id,
    type: found.type,
    description: found.description,
    brief: extra.brief ?? messages.find(one => one.role === 'user')?.text ?? '',
    status: found.status,
    lastTool: calls.at(-1),
    recent: calls.slice(-RECENT - 1, -1),
    toolCount: calls.length,
    startedAt: await $.clock.now(),
    seenLate: true,
    sessionId,
    durationMs: found.status === 'running' ? undefined : extra.durationMs,
    answer:
      found.status === 'running'
        ? undefined
        : messages.filter(one => one.role === 'assistant' && one.text).at(-1)?.text,
  }
  await update($, runs, list =>
    list.some(one => one.id === run.id) ? list : [...list, run].slice(-HISTORY),
  )
}

// Adds every sub-agent of the session the pane does not list yet: each Agent
// call in the main transcript, in the order the designer made them, then any
// agent in the session's agent list without one. The agent list drops an agent
// some time after it finishes, and the transcript keeps the call.
async function catchUp($: EngineInterface): Promise<void> {
  const known = new Set((await read($, runs)).map(one => one.id))
  const agents = await $.agent.list().catch(() => [] as AgentInfo[])
  const live = new Map(agents.map(agent => [agent.id, agent]))
  const main = await $.session.messages().catch(() => [])
  const calls = (Array.isArray(main) ? main : [])
    .flatMap(one => (one.role === 'assistant' ? one.toolUses : []))
    .filter(use => use.tool === 'Agent' && use.agentId !== undefined)

  for (const call of calls) {
    const id = call.agentId as string
    looked.add(id)
    if (known.has(id)) continue
    known.add(id)
    const input = call.input as { description?: string; prompt?: string; subagent_type?: string }
    const agent = live.get(id)
    await adopt(
      $,
      {
        id,
        type: agent?.type ?? input.subagent_type ?? 'general-purpose',
        description: agent?.description ?? input.description ?? '',
        status: agent ? statusOf(agent) : call.isError ? 'failed' : 'done',
      },
      { brief: input.prompt, durationMs: call.durationMs },
    )
  }
  for (const agent of agents) {
    looked.add(agent.id)
    if (known.has(agent.id)) continue
    known.add(agent.id)
    await adopt($, { ...agent, status: statusOf(agent) }, {})
  }
}

// Adds the run behind an event from an agent the pane does not list yet.
async function seen($: EngineInterface, id: string): Promise<void> {
  if (looked.has(id)) return
  looked.add(id)
  if ((await read($, runs)).some(one => one.id === id)) return
  const agent = (await $.agent.list()).find(one => one.id === id)
  if (agent) await adopt($, { ...agent, status: statusOf(agent) }, {})
}

// Adds the project's tasks from earlier chats, kept in the store. A task that
// was still working when its chat ended is left out.
async function loadHistory($: EngineInterface): Promise<void> {
  sessionId = await $.session.id().catch(() => undefined)
  const root = await $.session.root().catch(() => undefined)
  storeKey = root ? `runs:${root}` : undefined
  flagsKey = root ? `flags:${root}` : undefined
  projectKey = root ? `project:${root}` : undefined
  if (!storeKey) return
  const keptProjects = await $.store.get(`project:${root}`).catch(() => undefined)
  if (Array.isArray(keptProjects) && keptProjects.length > 0) {
    // This chat's project, or else the one set most recently in the folder.
    const all = (keptProjects as Project[])
      .filter(one => typeof one?.name === 'string' && typeof one.goal === 'string' && typeof one.at === 'number')
      .sort((a, b) => a.at - b.at)
    const mine = all.filter(one => one.sessionId === sessionId).at(-1) ?? all.at(-1)
    if (mine) await update($, project, current => current ?? mine)
  }
  const keptFlags = await $.store.get(`flags:${root}`).catch(() => undefined)
  if (Array.isArray(keptFlags)) {
    await update($, flags, list => {
      const ids = new Set(list.map(one => one.id))

      return [...(keptFlags as Flag[]).filter(one => !ids.has(one.id)), ...list]
    })
  }
  const stored = await $.store.get(storeKey).catch(() => undefined)
  if (!Array.isArray(stored)) return
  const earlier = (stored as Run[]).filter(
    run => run.sessionId !== sessionId && run.status !== 'running',
  )
  await update($, runs, list => {
    const ids = new Set(list.map(one => one.id))

    return [...earlier.filter(one => !ids.has(one.id)), ...list].slice(-HISTORY)
  })
}

// Keeps the project's tasks in the store, merged with what another chat in the
// project kept there meanwhile.
async function save($: EngineInterface): Promise<void> {
  if (!storeKey) return
  const stored = await $.store.get(storeKey).catch(() => undefined)
  const byId = new Map<string, Run>()
  for (const run of Array.isArray(stored) ? (stored as Run[]) : []) byId.set(run.id, run)
  for (const run of await read($, runs)) {
    if (run.type === DESIGNER && (run.status === 'running' || !produced(run))) continue
    byId.set(run.id, {
      ...run,
      brief: run.brief.slice(0, KEPT),
      answer: run.answer?.slice(0, KEPT),
    })
  }
  const kept = [...byId.values()]
    .sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt))
    .slice(-HISTORY)
  await $.store.set(storeKey, kept).catch(() => undefined)
}

// Keeps the project's flags in the store, merged with what another chat in the
// project kept there meanwhile. The last 100 stay.
async function saveFlags($: EngineInterface): Promise<void> {
  if (!flagsKey) return
  const stored = await $.store.get(flagsKey).catch(() => undefined)
  const byId = new Map<string, Flag>()
  for (const flag of Array.isArray(stored) ? (stored as Flag[]) : []) byId.set(flag.id, flag)
  for (const flag of await read($, flags)) byId.set(flag.id, flag)
  const kept = [...byId.values()].sort((a, b) => a.at - b.at).slice(-HISTORY)
  await $.store.set(flagsKey, kept).catch(() => undefined)
}

// Keeps the chat's project in the store, beside the latest project of each
// other chat in the folder.
async function saveProject($: EngineInterface, value: Project): Promise<void> {
  if (!projectKey) return
  const stored = await $.store.get(projectKey).catch(() => undefined)
  const others = (Array.isArray(stored) ? (stored as Project[]) : []).filter(
    one => typeof one?.name === 'string' && one.sessionId !== value.sessionId,
  )
  const kept = [...others, value].sort((a, b) => a.at - b.at).slice(-PROJECTS)
  await $.store.set(projectKey, kept).catch(() => undefined)
}

// The last part of a path, which names the file without the folders above it.
function shortPath(path: string): string {
  return path.split('/').filter(Boolean).slice(-2).join('/')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'now',
      description: "Show the team's tasks in this project in a pane",
    })
    // A reload runs session.start again, with the session's agents still working.
    await $.tool.register({
      name: 'flag_for_design_lead',
      description:
        "Shows a question or decision for the design lead at the top of the Now pane, and sends the design lead a notification. Call it when a team member's result needs the design lead's decision, or when your own work waits for the design lead's answer. Give the question in one sentence that makes sense without the conversation. Returns the flag's id, such as F3. Call resolve_flag with that id when the design lead answers.",
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question or decision for the design lead, in one sentence.',
          },
          agent_id: {
            type: 'string',
            description:
              'The agentId the Agent tool returned for the task the question comes from. Leave it out for a question from your own work.',
          },
        },
        required: ['question'],
      },
      isDeferred: false,
    }).catch(() => undefined)
    await $.tool.register({
      name: 'resolve_flag',
      description:
        'Clears a flag from the top of the Now pane once the design lead has answered it. Takes the id that flag_for_design_lead returned, such as F3.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The flag id, such as F3.' } },
        required: ['id'],
      },
      isDeferred: false,
    }).catch(() => undefined)
    await $.tool.register({
      name: 'set_project',
      description:
        "Sets the project summary at the top of the Now pane, so the design lead can see what the project is after time away, without reading the chat. Call it when the project is scoped, when a stage starts, and after each version, with what happens next. Fields left out keep their earlier value.",
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The issue and the project name, such as "ABC-123 · Billing page".',
          },
          goal: { type: 'string', description: 'One sentence on what the project is doing.' },
          stage: {
            type: 'string',
            description: 'The stage and the version, such as "Prototype, version 3".',
          },
          next: {
            type: 'string',
            description:
              'What happens next, in one sentence. Name the design lead when it waits on them.',
          },
          link: { type: 'string', description: 'The URL of the latest prototype or document.' },
        },
      },
      isDeferred: false,
    }).catch(() => undefined)
    await loadHistory($).catch(() => undefined)
    await catchUp($)
    await save($)

    return next(e)
  })

  on('command.run', { command: 'now' }, async $ => {
    await catchUp($).catch(() => undefined)
    await save($)
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Now pane opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined || started.agentId === undefined) return started

    looked.add(started.agentId)
    const run: Run = {
      id: started.agentId,
      type: e.subagentType,
      description: e.description,
      brief: e.prompt,
      status: 'running',
      toolCount: 0,
      startedAt: await $.clock.now(),
      sessionId,
    }
    // The designer's turn in progress gave the task.
    await update($, runs, list =>
      [
        ...list
          .filter(one => one.id !== run.id)
          .map((one): Run =>
            one.type === DESIGNER && one.status === 'running'
              ? { ...one, spawned: [...(one.spawned ?? []), run.id] }
              : one,
          ),
        run,
      ].slice(-HISTORY),
    )
    await save($)
    void $.ui.open({ id: PANE, title: TITLE })

    return started
  })

  // A run that SendMessage wakes again starts a new turn under the same id. A
  // turn on the main loop is the designer's own work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const at = await $.clock.now()
      const run: Run = {
        id: `${DESIGNER}-${e.turnId}`,
        type: DESIGNER,
        description: request(e.text),
        brief: e.text,
        status: 'running',
        toolCount: 0,
        startedAt: at,
        sessionId,
      }
      await update($, runs, list => {
        // A turn that ended without turn.complete, as at a reload, is over.
        const closed = list.map((one): Run =>
          one.type === DESIGNER && one.status === 'running'
            ? { ...one, status: 'stopped', endedAt: at }
            : one,
        )
        // A designer turn that only answered in the chat leaves the pane.
        const kept = closed.filter(one => one.type !== DESIGNER || produced(one))

        return [...kept, run].slice(-HISTORY)
      })
    } else {
      const id = e.agentId
      await seen($, id)
      await update($, runs, list =>
        list.map((one): Run =>
          one.id === id && one.status !== 'running'
            ? { ...one, status: 'running', endedAt: undefined }
            : one,
        ),
      )
    }

    return next(e)
  })

  on('tool.call', { tool: FLAG_TOOL }, async ($, e) => {
    const input = e as unknown as { question?: string; agent_id?: string }
    const question = (input.question ?? '').trim()
    if (!question) return { result: 'No flag: the question is empty.' }
    const known = await read($, flags)
    const id = `F${known.reduce((most, one) => Math.max(most, Number(one.id.slice(1)) || 0), 0) + 1}`
    const flag: Flag = { id, question, agentId: input.agent_id, at: await $.clock.now() }
    await update($, flags, list => [...list, flag].slice(-HISTORY))
    await saveFlags($)
    await update($, runs, list =>
      list.map((one): Run =>
        one.type === DESIGNER && one.status === 'running'
          ? { ...one, flagged: (one.flagged ?? 0) + 1 }
          : one,
      ),
    )
    void $.ui.open({ id: PANE, title: TITLE })
    const sent = await $.ui.notify(question, { title: 'Needs you' }).catch(() => undefined)

    return {
      result: `Flagged as ${id}. The Now pane shows it at the top${
        sent?.isSent ? ', and a notification went to the design lead' : ''
      }. Call resolve_flag with ${id} when the design lead answers.`,
    }
  })

  on('tool.call', { tool: RESOLVE_TOOL }, async ($, e) => {
    const id = String((e as unknown as { id?: string }).id ?? '').trim().toUpperCase()
    const open = (await read($, flags)).find(one => one.id === id && one.resolvedAt === undefined)
    if (!open) return { result: `No open flag ${id}.` }
    const at = await $.clock.now()
    await update($, flags, list => list.map(one => (one.id === id ? { ...one, resolvedAt: at } : one)))
    await saveFlags($)

    return { result: `${id} is cleared from the Now pane.` }
  })

  on('tool.call', { tool: PROJECT_TOOL }, async ($, e) => {
    const input = e as unknown as Partial<Record<'name' | 'goal' | 'stage' | 'next' | 'link', unknown>>
    const given: Partial<Project> = {}
    for (const field of ['name', 'goal', 'stage', 'next', 'link'] as const) {
      const value = input[field]
      if (typeof value === 'string' && value.trim()) given[field] = value.trim()
    }
    const current = await read($, project)
    const merged = { ...current, ...given }
    if (!merged.name || !merged.goal) {
      return { result: 'No project set: give a name and a goal the first time.' }
    }
    const value: Project = { ...merged, name: merged.name, goal: merged.goal, at: await $.clock.now(), sessionId }
    await update($, project, () => value)
    await saveProject($, value)

    return { result: 'The Now pane shows the project summary.' }
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) await seen($, id)
    const lastTool = step(e)
    const input = e as unknown as { file_path?: unknown; notebook_path?: unknown }
    const path = EDITS.has(e.tool)
      ? [input.file_path, input.notebook_path].find(
          (value): value is string => typeof value === 'string' && value.length > 0,
        )
      : undefined
    // A main-loop call belongs to the designer's turn in progress.
    const mine = (one: Run) =>
      id !== undefined ? one.id === id : one.type === DESIGNER && one.status === 'running'
    await update($, runs, list =>
      list.map(one =>
        mine(one)
          ? {
              ...one,
              lastTool,
              recent: one.lastTool ? [...(one.recent ?? []), one.lastTool].slice(-RECENT) : one.recent,
              toolCount: one.toolCount + 1,
              changed:
                path && !(one.changed ?? []).includes(path)
                  ? [...(one.changed ?? []), path]
                  : one.changed,
            }
          : one,
      ),
    )

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) await seen($, id)
    const status: RunStatus =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    const endedAt = await $.clock.now()
    const mine = (one: Run) =>
      id !== undefined ? one.id === id : one.type === DESIGNER && one.status === 'running'
    await update($, runs, list =>
      list.map(one => (mine(one) ? { ...one, status, endedAt, answer: e.answer } : one)),
    )
    if (id !== undefined) await save($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Markdown, Link } = elements
    // The animated working mark, where the surface draws a Client.
    const Client = 'Client' in elements ? elements.Client : undefined
    const list = await read($, runs)
    const waiting = (await read($, flags)).filter(one => one.resolvedAt === undefined)
    const about = await read($, project)
    const openId = await read($, selected)
    const open = list.find(one => one.id === openId)
    const now = await $.clock.now()
    const width = Math.max(20, e.props.bodyColumns)
    const rows = e.props.scroll?.bodyRows ?? 0
    const double = '═'.repeat(width)
    const single = '─'.repeat(width)
    // A copy loaded with --plugin-dir sits outside the plugin cache.
    const local =
      LOCAL ?? ($.plugin.root.includes('/.claude/plugins/cache/') ? undefined : 'CHECKOUT')

    // One label and value row, as in a printed manual's specification table.
    const field = (label: string, value: RenderChildren, dim = false) => (
      <Box flexDirection="row">
        <Box width={LABEL} flexShrink={0}>
          <Text dimColor>{label}</Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor={dim} wrap="wrap">
            {value}
          </Text>
        </Box>
      </Box>
    )

    // The page: the content, then the version line at the bottom of the pane.
    const page = (...content: RenderChildren[]) => (
      <Box flexDirection="column" width={width} minHeight={rows}>
        <Box flexDirection="column" flexGrow={1}>
          {content}
        </Box>
        <Text dimColor>{single}</Text>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>NOW VIEW {VERSION}</Text>
          {local && (
            <Box flexShrink={1}>
              <Text inverse wrap="truncate-end"> LOCAL {local} </Text>
            </Box>
          )}
        </Box>
      </Box>
    )

    // A file a task changed, as a link that opens it.
    const fileLink = (path: string) => <Link href={`file://${path}`} label={shortPath(path)} />

    // One empty row, between one section and the next.
    const gap = (key: string) => <Box key={`gap-${key}`} height={1} />

    // What needs the design lead: each open flag, newest last, with the task it
    // comes from.
    const band = (
      <Box
        borderStyle={waiting.length > 0 ? 'bold' : 'single'}
        borderColor={waiting.length > 0 ? 'warning' : undefined}
        borderDimColor={waiting.length === 0}
        flexDirection="column"
        paddingX={1}
      >
        {waiting.length === 0 ? (
          <Box flexDirection="column">
            <Text bold>NOTHING NEEDS YOU</Text>
            <Text dimColor wrap="wrap">
              A question for you shows here first.
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text bold color="warning">
              {waiting.length === 1 ? '1 THING NEEDS YOU' : `${waiting.length} THINGS NEED YOU`}
            </Text>
            <Text dimColor>Answer in the chat</Text>
            {waiting.map(flag => {
              const from = list.find(one => one.id === flag.agentId)

              return (
                <Box key={`flag-${flag.id}`} flexDirection="column" marginTop={1}>
                  <Text wrap="wrap">{flag.question}</Text>
                  <Box flexDirection="row" justifyContent="space-between">
                    <Box flexShrink={1}>
                      <Text dimColor wrap="wrap">
                        - {from ? role(from.type) : role(DESIGNER)}
                      </Text>
                    </Box>
                    <Button
                      key={`answered-${flag.id}`}
                      plain
                      onPress={async () => {
                        const at = await $.clock.now()
                        await update($, flags, all =>
                          all.map(one => (one.id === flag.id ? { ...one, resolvedAt: at } : one)),
                        )
                        await saveFlags($)
                      }}
                    >
                      <Text bold>Done</Text>
                    </Button>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )

    // What the project is: the first thing the design lead reads after time away.
    const header = about ? (
      <Box flexDirection="column">
        <Text bold wrap="wrap">
          {about.name.toUpperCase()}
        </Text>
        <Text wrap="wrap">{about.goal}</Text>
        <Box height={1} />
        {about.stage && field('STAGE', about.stage)}
        {about.next && field('NEXT', about.next)}
        {about.link && field('OPEN', <Link href={about.link} label={about.link.replace(/^https?:\/\//, '')} />)}
        {field('UPDATED', stamp(about.at, now), true)}
      </Box>
    ) : (
      <Box flexDirection="column">
        <Text bold>NO PROJECT YET</Text>
        <Text dimColor wrap="wrap">
          The designer names the project here, with its goal and what comes next.
        </Text>
      </Box>
    )

    const started = (run: Run) =>
      run.seenLate
        ? run.status === 'running'
          ? `FIRST SEEN ${clockTime(run.startedAt)}. STARTED EARLIER`
          : 'EARLIER IN THE SESSION'
        : run.status === 'running'
          ? `${clockTime(run.startedAt)}, ${duration(now - run.startedAt)} AGO`
          : clockTime(run.startedAt)

    // What a task is doing now, and the files it changed.
    // NOW holds two rows on a card whatever the step's length, so a card keeps
    // its height as the steps change. A task's own view shows the step whole.
    // On a card the step sits under the role, indented, with the turning mark
    // before it.
    const INDENT = 4
    const MARK = 2
    const stepRows = (run: Run) =>
      fixedLines(run.lastTool ?? 'Getting started', Math.max(10, width - 4 - INDENT - MARK), 2).map(
        (line, index) => (
          <Box key={`step-${run.id}-${index}`} flexDirection="row" paddingLeft={INDENT}>
            <Box width={MARK} flexShrink={0}>
              {index > 0 ? (
                <Text> </Text>
              ) : Client ? (
                <Client key={`mark-${run.id}`} module="./working.tsx" props={{ since: null, show: 'mark' }} />
              ) : (
                <Text bold>✳</Text>
              )}
            </Box>
            <Text>{line || ' '}</Text>
          </Box>
        ),
      )
    const progress = (run: Run, fixed = false) => [
      ...(run.status !== 'running'
        ? []
        : fixed
          ? stepRows(run)
          : [field('NOW', run.lastTool ?? 'Getting started')]),
      ...(run.changed ?? [])
        .slice(-CHANGED)
        .map((path, index) => (
          <Box key={`changed-${run.id}-${index}`} paddingLeft={fixed ? INDENT : 0}>
            {field(index === 0 ? 'CHANGED' : '', fileLink(path))}
          </Box>
        )),
      (run.changed?.length ?? 0) > CHANGED && (
        <Box key={`more-${run.id}`} paddingLeft={fixed ? INDENT : 0}>
          {field('', `and ${(run.changed?.length ?? 0) - CHANGED} more`, true)}
        </Box>
      ),
    ]

    if (open) {
      // The designer's turn is the chat itself, with no transcript of its own.
      const own = open.type === DESIGNER

      return page(
        <Box flexDirection="row" justifyContent="space-between">
          <Button key="back" hotkey="b" onPress={() => update($, selected, () => null)}>
            Back to the list
          </Button>
          {!own && (
            <Button key="transcript" hotkey="t" onPress={() => $.ui.view({ agentId: open.id })}>
              Open its transcript
            </Button>
          )}
        </Box>,
        <Box borderStyle="double" flexDirection="column" paddingX={1} marginTop={1}>
          <Text bold>{role(open.type)}</Text>
          {/* The designer's task is the request below, so the box names the role alone. */}
          {!own && <Text wrap="wrap">{open.description}</Text>}
        </Box>,
        ...waiting
          .filter(flag => flag.agentId === open.id)
          .map(flag => field('NEEDS YOU', flag.question)),
        field('STATUS', open.status === 'running' ? 'IN PROGRESS' : outcome(open)),
        field('STARTED', started(open)),
        ...progress(open),
        ...(open.spawned ?? [])
          .map(id => list.find(one => one.id === id))
          .filter((one): one is Run => one !== undefined)
          .map((one, index) => field(index === 0 ? 'TASKS' : '', `${role(one.type)}: ${one.description}`)),
        gap('brief'),
        <Text>{double}</Text>,
        <Text bold>{own ? 'YOUR REQUEST' : 'BRIEF FROM THE DESIGNER'}</Text>,
        <Text dimColor>{single}</Text>,
        open.brief ? <Markdown text={open.brief} /> : <Text dimColor>No brief was recorded.</Text>,
        gap('answer'),
        <Text>{double}</Text>,
        <Text bold>{own ? 'ANSWER TO YOU' : 'ANSWER TO THE DESIGNER'}</Text>,
        <Text dimColor>{single}</Text>,
        open.answer ? <Markdown text={open.answer} /> : <Text dimColor>{NO_ANSWER[open.status]}</Text>,
      )
    }

    // The designer's card comes first. A finished designer turn is listed when
    // it changed a file, gave the team a task or flagged a question.
    const team = list.filter(one => one.type !== DESIGNER)
    const running = [
      ...list.filter(one => one.type === DESIGNER && one.status === 'running'),
      ...team.filter(one => one.status === 'running'),
    ]
    // The designer's latest turn always has a row, which its next turn
    // replaces when it only answered in the chat.
    const latest = list.filter(one => one.type === DESIGNER).at(-1)
    const finished = list
      .filter(
        one =>
          one.status !== 'running' && (one.type !== DESIGNER || produced(one) || one === latest),
      )
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))

    if (list.length === 0) {
      return page(
        header,
        gap('header'),
        band,
        gap('empty'),
        <Text bold>No tasks yet</Text>,
        <Text wrap="wrap">
          When the designer gives a task to a team member, such as the copywriter or the
          researcher, the task shows here while it is in progress and after it finishes.
        </Text>,
        <Text dimColor wrap="wrap">
          Select a task to read the designer's brief and the team member's answer.
        </Text>,
      )
    }

    return page(
      header,
      gap('header'),
      band,
      gap('running'),
      // The section titles stay dim, so the cards hold the eye.
      <Text dimColor>RUNNING ({running.length})</Text>,
      <Text dimColor>{single}</Text>,
      running.length === 0 && <Text dimColor>Nothing is running.</Text>,
      ...running.map(run => (
        <Box key={`card-${run.id}`} borderStyle="single" flexDirection="column" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Button key={run.id} plain onPress={() => update($, selected, () => run.id)}>
              <Text bold wrap="wrap">
                {role(run.type)}
              </Text>
            </Button>
            {Client ? (
              <Client
                key={`working-${run.id}`}
                module="./working.tsx"
                props={{ since: run.seenLate ? null : run.startedAt, show: 'time' }}
              />
            ) : (
              <Text bold>{run.seenLate ? '' : duration(now - run.startedAt)}</Text>
            )}
          </Box>
          {/* The designer's task is the design lead's own request, so its card shows the step alone. */}
          {run.type !== DESIGNER && <Text wrap="wrap">{run.description}</Text>}
          {progress(run, true)}
        </Box>
      )),
      finished.length > 0 && gap('finished'),
      finished.length > 0 && <Text dimColor>FINISHED ({finished.length})</Text>,
      finished.length > 0 && <Text dimColor>{single}</Text>,
      ...finished.slice(0, SHOWN).map(run => (
        <Box key={`row-${run.id}`} flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Button key={run.id} plain onPress={() => update($, selected, () => run.id)}>
              {role(run.type)}
            </Button>
            <Box flexShrink={0} marginLeft={1}>
              {waiting.some(flag => flag.agentId === run.id) ? (
                <Text bold color="warning">
                  NEEDS YOU
                </Text>
              ) : (
                <Text dimColor>
                  {outcome(run)}
                  {run.endedAt !== undefined ? `, ${stamp(run.endedAt, now)}` : ''}
                </Text>
              )}
            </Box>
          </Box>
          <Box paddingLeft={4}>
            <Text wrap="wrap">{run.type === DESIGNER ? didWhat(run) : run.description}</Text>
          </Box>
          {run.type === DESIGNER && produced(run) && (
            <Box paddingLeft={4}>
              <Text dimColor wrap="wrap">
                {listed(
                  [
                    run.spawned?.length
                      ? `${run.spawned.length} ${run.spawned.length === 1 ? 'task' : 'tasks'} for the team`
                      : '',
                    run.changed?.length
                      ? `${run.changed.length} ${run.changed.length === 1 ? 'file' : 'files'} changed`
                      : '',
                    run.flagged
                      ? `${run.flagged} ${run.flagged === 1 ? 'question' : 'questions'} for you`
                      : '',
                  ].filter(Boolean),
                )}
              </Text>
            </Box>
          )}
          {(run.changed ?? [])
            .filter(path => /\.(md|mdx|markdown)$/i.test(path))
            .map(path => (
              <Box key={`report-${run.id}-${path}`} paddingLeft={4}>
                <Text dimColor wrap="wrap">
                  {fileLink(path)}
                </Text>
              </Box>
            ))}
          <Text dimColor>{single}</Text>
        </Box>
      )),
      finished.length > SHOWN && (
        <Text dimColor wrap="wrap">
          {finished.length - SHOWN} earlier finished tasks are in the project's history.
        </Text>
      ),
    )
  })
}
