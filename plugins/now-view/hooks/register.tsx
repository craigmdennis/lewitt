import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register } from 'claude-code'

import type { Run, RunStatus } from '../types'

const PANE = 'now-view'
const TITLE = 'Now'
const RECENT = 3
const LABEL = 9
// Change the tag when a run's fields change in a way an earlier value cannot
// meet: it declines what an earlier version stored, which outlives a reload.
// The fields added since runs-1 are optional, so its values still read.
const runs = atom({ plugin: 'now-view', key: 'runs' } as const, [], {
  shape: 'runs-1',
})
const selected = atom({ plugin: 'now-view', key: 'selected' } as const, null)

// The ids already looked up in the session's agent list, so a run the list
// does not hold, such as a workflow's, is looked up once.
const looked = new Set<string>()

// The tool's name and the one input field that says what it is doing.
function describeTool(e: { tool: string }): string {
  const input = e as unknown as Record<string, unknown>
  const detail = ['description', 'file_path', 'pattern', 'query', 'url', 'command']
    .map(field => input[field])
    .find(value => typeof value === 'string' && value.length > 0) as string | undefined
  const tool = e.tool.replace(/^mcp__/, '').replace(/__/g, ' ')

  return detail ? `${tool}: ${(detail.split('\n')[0] ?? '').slice(0, 80)}` : tool
}

function clockTime(ms: number): string {
  const time = new Date(ms)

  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
}

function duration(ms: number): string {
  const minutes = Math.round(ms / 60000)

  return minutes < 1 ? `${Math.round(ms / 1000)} SEC` : `${minutes} MIN`
}

function toolCalls(count: number): string {
  return count === 1 ? '1 CALL' : `${count} CALLS`
}

const STATUS: Record<RunStatus, string> = {
  running: 'RUNNING',
  done: 'FINISHED',
  stopped: 'STOPPED',
  failed: 'FAILED',
}

// How a finished run ended. A run seen late has no true start, so no duration.
function outcome(run: Run): string {
  if (!run.endedAt || run.seenLate) return STATUS[run.status]
  const took = duration(run.endedAt - run.startedAt)

  return run.status === 'done' ? `FINISHED IN ${took}` : `${STATUS[run.status]} AFTER ${took}`
}

const NO_ANSWER: Record<RunStatus, string> = {
  running: 'No answer yet. The sub-agent is still working.',
  done: 'The sub-agent finished without an answer.',
  stopped: 'No answer. The task was stopped before it finished.',
  failed: 'No answer. The task failed before it finished.',
}

function statusOf(agent: AgentInfo): RunStatus {
  if (agent.status === 'completed') return 'done'
  if (agent.status === 'failed') return 'failed'
  if (agent.status === 'killed') return 'stopped'

  return 'running'
}

// A run that started before the plugin loaded: its record from the session's
// agent list, and its brief, tool calls and answer from its transcript.
async function adopt($: EngineInterface, agent: AgentInfo): Promise<void> {
  const found = await $.session.messages({ agentId: agent.id })
  const messages = Array.isArray(found) ? found : []
  const uses = messages.flatMap(one => (one.role === 'assistant' ? one.toolUses : []))
  const calls = uses.map(use => describeTool({ ...use.input, tool: use.tool }))
  const status = statusOf(agent)
  const now = await $.clock.now()
  const run: Run = {
    id: agent.id,
    type: agent.type,
    description: agent.description,
    brief: messages.find(one => one.role === 'user')?.text ?? '',
    status,
    lastTool: calls.at(-1),
    recent: calls.slice(-RECENT - 1, -1),
    toolCount: calls.length,
    startedAt: now,
    seenLate: true,
    endedAt: status === 'running' ? undefined : now,
    answer:
      status === 'running'
        ? undefined
        : messages.filter(one => one.role === 'assistant' && one.text).at(-1)?.text,
  }
  await update($, runs, list =>
    list.some(one => one.id === run.id) ? list : [...list, run].slice(-100),
  )
}

// Adds every agent of the session the pane does not list yet.
async function catchUp($: EngineInterface): Promise<void> {
  const known = new Set((await read($, runs)).map(one => one.id))
  for (const agent of await $.agent.list()) {
    looked.add(agent.id)
    if (!known.has(agent.id)) await adopt($, agent)
  }
}

// Adds the run behind an event from an agent the pane does not list yet.
async function seen($: EngineInterface, id: string): Promise<void> {
  if (looked.has(id)) return
  looked.add(id)
  if ((await read($, runs)).some(one => one.id === id)) return
  const agent = (await $.agent.list()).find(one => one.id === id)
  if (agent) await adopt($, agent)
}

// The version of the copy that loaded, and where it came from. A copy that
// scripts/now-view.sh made from a checkout has .local.json beside plugin.json.
// A copy loaded with --plugin-dir sits outside the plugin cache.
type Build = { version?: string; local?: string }
let build: Build = {}

async function readBuild($: EngineInterface): Promise<Build> {
  const root = $.plugin.root
  const manifest = await $.fs
    .read(`${root}/.claude-plugin/plugin.json`)
    .then(text => JSON.parse(text as string) as { version?: string })
    .catch(() => ({}) as { version?: string })
  const marker = await $.fs
    .read(`${root}/.local.json`)
    .then(text => JSON.parse(text as string) as { commit?: string })
    .catch(() => undefined)
  const local = marker
    ? `LOCAL ${marker.commit ?? ''}`.trim()
    : root.includes('/.claude/plugins/cache/')
      ? undefined
      : 'LOCAL CHECKOUT'

  return { version: manifest.version, local }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'now',
      description: 'Show the subagent runs of this session in a pane',
    })
    // A reload runs session.start again, with the session's agents still working.
    build = await readBuild($).catch(() => ({}))
    await catchUp($)

    return next(e)
  })

  on('command.run', { command: 'now' }, async $ => {
    await catchUp($)
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
    }
    await update($, runs, list => [...list.filter(one => one.id !== run.id), run].slice(-100))
    void $.ui.open({ id: PANE, title: TITLE })

    return started
  })

  // A run that SendMessage wakes again starts a new turn under the same id.
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) {
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

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await seen($, id)
      const lastTool = describeTool(e)
      await update($, runs, list =>
        list.map(one =>
          one.id === id
            ? {
                ...one,
                lastTool,
                recent: one.lastTool ? [...(one.recent ?? []), one.lastTool].slice(-RECENT) : one.recent,
                toolCount: one.toolCount + 1,
              }
            : one,
        ),
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await seen($, id)
      const status: RunStatus =
        e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
      const endedAt = await $.clock.now()
      await update($, runs, list =>
        list.map(one =>
          one.id === id ? { ...one, status, endedAt, answer: e.answer } : one,
        ),
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const list = await read($, runs)
    const openId = await read($, selected)
    const open = list.find(one => one.id === openId)
    const now = await $.clock.now()
    const width = Math.max(20, e.props.bodyColumns)
    const double = '═'.repeat(width)
    const single = '─'.repeat(width)

    // The version, and LOCAL with its commit for a copy made from a checkout.
    const footer = (
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>{single}</Text>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>NOW VIEW {build.version ?? ''}</Text>
          {build.local ? <Text inverse> {build.local} </Text> : <Text dimColor>LIVE</Text>}
        </Box>
      </Box>
    )

    // One label and value row, as in a printed manual's specification table.
    const field = (label: string, value: string, dim = false) => (
      <Box flexDirection="row">
        <Box width={LABEL} flexShrink={0}>
          <Text dimColor>{label}</Text>
        </Box>
        <Text dimColor={dim} wrap="truncate-end">
          {value}
        </Text>
      </Box>
    )

    const started = (run: Run) =>
      run.seenLate
        ? `${clockTime(run.startedAt)}, FIRST SEEN. STARTED EARLIER`
        : run.status === 'running'
          ? `${clockTime(run.startedAt)}, ${duration(now - run.startedAt)} AGO`
          : clockTime(run.startedAt)

    if (open) {
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Button key="back" hotkey="b" onPress={() => update($, selected, () => null)}>
              Back to the list
            </Button>
            <Button key="transcript" hotkey="t" onPress={() => $.ui.view({ agentId: open.id })}>
              Open its transcript
            </Button>
          </Box>
          <Box borderStyle="double" flexDirection="column" paddingX={1} marginTop={1}>
            <Text bold>{open.type.toUpperCase()}</Text>
            <Text>{open.description}</Text>
          </Box>
          {field('STATUS', open.status === 'running' ? 'RUNNING' : outcome(open))}
          {field('STARTED', started(open))}
          {field('TOOLS', toolCalls(open.toolCount))}
          {open.lastTool && field('LATEST', open.lastTool)}
          <Text>{double}</Text>
          <Text bold>BRIEF FROM THE DESIGNER</Text>
          <Text dimColor>{single}</Text>
          {open.brief ? <Markdown text={open.brief} /> : <Text dimColor>No brief was recorded.</Text>}
          <Text>{double}</Text>
          <Text bold>ANSWER TO THE DESIGNER</Text>
          <Text dimColor>{single}</Text>
          {open.answer ? <Markdown text={open.answer} /> : <Text dimColor>{NO_ANSWER[open.status]}</Text>}
          {footer}
        </Box>
      )
    }

    const running = list.filter(one => one.status === 'running')
    const finished = list.filter(one => one.status !== 'running').reverse()
    const order = [...running, ...finished]
    const hotkey = (run: Run) => {
      const index = order.indexOf(run)

      return index < 9 ? String(index + 1) : undefined
    }
    const mark = (run: Run) => (hotkey(run) ? `[${hotkey(run)}] ` : '')

    const header = (
      <Box borderStyle="double" flexDirection="row" justifyContent="space-between" paddingX={1}>
        <Box flexDirection="column">
          <Text bold>NOW</Text>
          <Text>SUB-AGENT TASKS</Text>
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text>{running.length} WORKING</Text>
          <Text>{finished.length} FINISHED</Text>
        </Box>
      </Box>
    )

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          {header}
          <Text bold>No sub-agent tasks yet</Text>
          <Text>
            When the designer gives a task to a sub-agent, such as the copywriter or the researcher,
            the task shows here while it runs and after it finishes.
          </Text>
          <Text dimColor>Select a task to read the designer's brief and the sub-agent's answer.</Text>
          {footer}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {header}
        {running.length > 0 && <Text bold>WORKING ({running.length})</Text>}
        {running.length > 0 && <Text>{double}</Text>}
        {running.map(run => (
          <Box key={`card-${run.id}`} borderStyle="single" flexDirection="column" paddingX={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Button key={run.id} plain hotkey={hotkey(run)} onPress={() => update($, selected, () => run.id)}>
                <Text bold>
                  {mark(run)}
                  {run.type.toUpperCase()}
                </Text>
              </Button>
              <Text inverse> RUNNING </Text>
            </Box>
            <Text>{run.description}</Text>
            <Text dimColor>{'─'.repeat(Math.max(1, width - 4))}</Text>
            {field('STARTED', started(run))}
            {field('TOOLS', toolCalls(run.toolCount))}
            {field('NOW', run.lastTool ?? 'Starting')}
            {(run.recent ?? [])
              .slice()
              .reverse()
              .map((call, index) => field(index === 0 ? 'BEFORE' : '', call, true))}
          </Box>
        ))}
        {finished.length > 0 && <Text bold>FINISHED ({finished.length})</Text>}
        {finished.length > 0 && <Text>{double}</Text>}
        {finished.map(run => (
          <Box key={`row-${run.id}`} flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Button key={run.id} plain hotkey={hotkey(run)} onPress={() => update($, selected, () => run.id)}>
                {mark(run)}
                {run.type.toUpperCase()}
              </Button>
              <Text dimColor>{outcome(run)}</Text>
            </Box>
            <Text dimColor>
              {'    '}
              {run.description}
            </Text>
            <Text dimColor>{single}</Text>
          </Box>
        ))}
        <Text dimColor>Press a task's number to read its brief and answer.</Text>
        {footer}
      </Box>
    )
  })
}
