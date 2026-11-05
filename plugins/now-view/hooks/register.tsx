import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Run, RunStatus } from '../types'
import { LOCAL, VERSION } from './build'

const PANE = 'now-view'
const TITLE = 'Now'
const RECENT = 3
const ACTIVITY = 8
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

// What the pane needs of an agent, from the session's agent list or from an
// Agent call in the main transcript.
type Found = { id: string; type: string; description: string; status: RunStatus }

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

function firstLine(text: string): string {
  return (text.split('\n').find(line => line.trim().length > 0) ?? '').replace(/^[#>*\-\s]+/, '')
}

const STATUS: Record<RunStatus, string> = {
  running: 'RUNNING',
  done: 'FINISHED',
  stopped: 'STOPPED',
  failed: 'FAILED',
}

const VERB: Record<RunStatus, string> = {
  running: 'started',
  done: 'finished',
  stopped: 'was stopped',
  failed: 'failed',
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
  const calls = uses.map(use => describeTool({ ...use.input, tool: use.tool }))
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
    durationMs: found.status === 'running' ? undefined : extra.durationMs,
    answer:
      found.status === 'running'
        ? undefined
        : messages.filter(one => one.role === 'assistant' && one.text).at(-1)?.text,
  }
  await update($, runs, list =>
    list.some(one => one.id === run.id) ? list : [...list, run].slice(-100),
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'now',
      description: 'Show the subagent runs of this session in a pane',
    })
    // A reload runs session.start again, with the session's agents still working.
    await catchUp($)

    return next(e)
  })

  on('command.run', { command: 'now' }, async $ => {
    await catchUp($).catch(() => undefined)
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
    const rows = e.props.scroll?.bodyRows ?? 0
    const double = '═'.repeat(width)
    const single = '─'.repeat(width)
    // A copy loaded with --plugin-dir sits outside the plugin cache.
    const local =
      LOCAL ?? ($.plugin.root.includes('/.claude/plugins/cache/') ? undefined : 'CHECKOUT')

    // One label and value row, as in a printed manual's specification table.
    const field = (label: string, value: string, dim = false) => (
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

    const started = (run: Run) =>
      run.seenLate
        ? run.status === 'running'
          ? `FIRST SEEN ${clockTime(run.startedAt)}. STARTED EARLIER`
          : 'EARLIER IN THE SESSION'
        : run.status === 'running'
          ? `${clockTime(run.startedAt)}, ${duration(now - run.startedAt)} AGO`
          : clockTime(run.startedAt)

    if (open) {
      return page(
        <Box flexDirection="row" justifyContent="space-between">
          <Button key="back" hotkey="b" onPress={() => update($, selected, () => null)}>
            Back to the list
          </Button>
          <Button key="transcript" hotkey="t" onPress={() => $.ui.view({ agentId: open.id })}>
            Open its transcript
          </Button>
        </Box>,
        <Box borderStyle="double" flexDirection="column" paddingX={1} marginTop={1}>
          <Text bold>{open.type.toUpperCase()}</Text>
          <Text wrap="wrap">{open.description}</Text>
        </Box>,
        field('STATUS', open.status === 'running' ? 'RUNNING' : outcome(open)),
        field('STARTED', started(open)),
        field('TOOLS', toolCalls(open.toolCount)),
        open.lastTool && field('LATEST', open.lastTool),
        <Text>{double}</Text>,
        <Text bold>BRIEF FROM THE DESIGNER</Text>,
        <Text dimColor>{single}</Text>,
        open.brief ? <Markdown text={open.brief} /> : <Text dimColor>No brief was recorded.</Text>,
        <Text>{double}</Text>,
        <Text bold>ANSWER TO THE DESIGNER</Text>,
        <Text dimColor>{single}</Text>,
        open.answer ? <Markdown text={open.answer} /> : <Text dimColor>{NO_ANSWER[open.status]}</Text>,
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
    const calls = list.reduce((sum, one) => sum + one.toolCount, 0)

    const header = (
      <Box borderStyle="double" flexDirection="row" justifyContent="space-between" paddingX={1}>
        <Box flexDirection="column" flexShrink={1}>
          <Text bold>NOW</Text>
          <Text wrap="wrap">SUB-AGENT TASKS</Text>
        </Box>
        <Box flexDirection="column" alignItems="flex-end" flexShrink={1}>
          <Text>
            {running.length} WORKING, {finished.length} FINISHED
          </Text>
          <Text>{toolCalls(calls).replace('CALL', 'TOOL CALL')}</Text>
        </Box>
      </Box>
    )

    if (list.length === 0) {
      return page(
        header,
        <Text bold>No sub-agent tasks yet</Text>,
        <Text wrap="wrap">
          When the designer gives a task to a sub-agent, such as the copywriter or the researcher,
          the task shows here while it runs and after it finishes.
        </Text>,
        <Text dimColor wrap="wrap">
          Select a task to read the designer's brief and the sub-agent's answer.
        </Text>,
      )
    }

    // What happened, newest first: each start and end the pane saw, then the
    // runs that finished before the plugin loaded.
    const events = list
      .flatMap(run => [
        ...(run.seenLate ? [] : [{ at: run.startedAt, run, verb: VERB.running }]),
        ...(run.endedAt !== undefined && run.status !== 'running'
          ? [{ at: run.endedAt, run, verb: VERB[run.status] }]
          : []),
      ])
      .sort((a, b) => b.at - a.at)
    const earlier = list.filter(
      run => run.seenLate && run.status !== 'running' && run.endedAt === undefined,
    )
    const activity = [
      ...events.map(one => ({ when: clockTime(one.at), run: one.run, verb: one.verb })),
      ...earlier.reverse().map(run => ({ when: 'EARLIER', run, verb: VERB[run.status] })),
    ].slice(0, ACTIVITY)

    return page(
      header,
      running.length > 0 && <Text bold>WORKING ({running.length})</Text>,
      running.length > 0 && <Text>{double}</Text>,
      ...running.map(run => (
        <Box key={`card-${run.id}`} borderStyle="single" flexDirection="column" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Button key={run.id} plain hotkey={hotkey(run)} onPress={() => update($, selected, () => run.id)}>
              <Text bold wrap="wrap">
                {mark(run)}
                {run.type.toUpperCase()}
              </Text>
            </Button>
            <Text inverse> RUNNING </Text>
          </Box>
          <Text wrap="wrap">{run.description}</Text>
          <Text dimColor>{'─'.repeat(Math.max(1, width - 4))}</Text>
          {field('STARTED', started(run))}
          {field('TOOLS', toolCalls(run.toolCount))}
          {field('NOW', run.lastTool ?? 'Starting')}
          {(run.recent ?? [])
            .slice()
            .reverse()
            .map((call, index) => field(index === 0 ? 'BEFORE' : '', call, true))}
        </Box>
      )),
      finished.length > 0 && <Text bold>FINISHED ({finished.length})</Text>,
      finished.length > 0 && <Text>{double}</Text>,
      ...finished.map(run => (
        <Box key={`row-${run.id}`} flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Button key={run.id} plain hotkey={hotkey(run)} onPress={() => update($, selected, () => run.id)}>
              {mark(run)}
              {run.type.toUpperCase()}
            </Button>
            <Box flexShrink={0} marginLeft={1}>
              <Text dimColor>{outcome(run)}</Text>
            </Box>
          </Box>
          <Box paddingLeft={4}>
            <Text wrap="wrap">{run.description}</Text>
          </Box>
          {run.answer && (
            <Box paddingLeft={4}>
              <Text dimColor wrap="wrap">
                {firstLine(run.answer)}
              </Text>
            </Box>
          )}
          <Text dimColor>{single}</Text>
        </Box>
      )),
      <Text bold>ACTIVITY</Text>,
      <Text>{double}</Text>,
      ...activity.map(one => (
        <Box flexDirection="row">
          <Box width={LABEL} flexShrink={0}>
            <Text dimColor>{one.when}</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1}>
            <Text wrap="wrap">
              {one.run.type.toUpperCase()} {one.verb}: {one.run.description}
            </Text>
          </Box>
        </Box>
      )),
      <Text dimColor wrap="wrap">
        Press a task's number to read its brief and answer.
      </Text>,
    )
  })
}
