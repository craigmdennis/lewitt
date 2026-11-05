import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Run, RunStatus } from '../types'

const PANE = 'now-view'
const TITLE = 'Now'
// Change the tag when a run's fields change: it declines what an earlier
// version stored, which outlives a reload.
const runs = atom({ plugin: 'now-view', key: 'runs' } as const, [], {
  shape: 'runs-1',
})
const selected = atom({ plugin: 'now-view', key: 'selected' } as const, null)

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

  return minutes < 1 ? `${Math.round(ms / 1000)}s` : `${minutes}m`
}

function toolCalls(count: number): string {
  return count === 1 ? '1 tool call' : `${count} tool calls`
}

// How a finished run ended, for its row and its detail line.
function outcome(run: Run): string {
  const took = run.endedAt ? duration(run.endedAt - run.startedAt) : ''
  if (run.status === 'done') return took ? `Finished in ${took}` : 'Finished'
  const verb = run.status === 'stopped' ? 'Stopped' : 'Failed'

  return took ? `${verb} after ${took}` : verb
}

const NO_ANSWER: Record<RunStatus, string> = {
  running: 'No answer yet. The sub-agent is still working.',
  done: 'The sub-agent finished without an answer.',
  stopped: 'No answer. The task was stopped before it finished.',
  failed: 'No answer. The task failed before it finished.',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'now',
      description: 'Show the subagent runs of this session in a pane',
    })

    return next(e)
  })

  on('command.run', { command: 'now' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Now pane opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined || started.agentId === undefined) return started

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
      const lastTool = describeTool(e)
      await update($, runs, list =>
        list.map(one =>
          one.id === id ? { ...one, lastTool, toolCount: one.toolCount + 1 } : one,
        ),
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
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

    if (open) {
      const meta =
        open.status === 'running'
          ? `Working since ${clockTime(open.startedAt)}, ${toolCalls(open.toolCount)} so far`
          : `${outcome(open)}, started ${clockTime(open.startedAt)}, ${toolCalls(open.toolCount)}`

      return (
        <Box flexDirection="column">
          <Button key="back" hotkey="b" onPress={() => update($, selected, () => null)}>
            Back to the list
          </Button>
          <Text bold>
            {open.type}: {open.description}
          </Text>
          <Text dimColor>{meta}</Text>
          {open.lastTool && <Text dimColor>Latest tool call: {open.lastTool}</Text>}
          <Text bold>Brief from the designer</Text>
          <Markdown text={open.brief} />
          <Text bold>Answer to the designer</Text>
          {open.answer ? <Markdown text={open.answer} /> : <Text dimColor>{NO_ANSWER[open.status]}</Text>}
        </Box>
      )
    }

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text bold>No sub-agent tasks yet</Text>
          <Text>
            When the designer gives a task to a sub-agent, such as the copywriter or the researcher,
            the task shows here while it runs and after it finishes.
          </Text>
          <Text dimColor>Select a task to read the designer's brief and the sub-agent's answer.</Text>
        </Box>
      )
    }

    const running = list.filter(one => one.status === 'running')
    const finished = list.filter(one => one.status !== 'running').reverse()

    return (
      <Box flexDirection="column">
        <Text dimColor>
          Tasks the designer gave to sub-agents in this session. Select one to read its brief and
          answer.
        </Text>
        {running.length > 0 && <Text bold>Working ({running.length})</Text>}
        {running.map(run => (
          <Box key={run.id} flexDirection="column">
            <Button key={run.id} plain onPress={() => update($, selected, () => run.id)}>
              {run.type}: {run.description}{' '}
              <Text dimColor>since {clockTime(run.startedAt)}</Text>
            </Button>
            <Text dimColor>
              {'  '}
              {run.lastTool ? `Now: ${run.lastTool}` : 'Starting'}
            </Text>
          </Box>
        ))}
        {finished.length > 0 && <Text bold>Finished ({finished.length})</Text>}
        {finished.map(run => (
          <Button key={run.id} plain onPress={() => update($, selected, () => run.id)}>
            {run.type}: {run.description} <Text dimColor>{outcome(run).toLowerCase()}</Text>
          </Button>
        ))}
      </Box>
    )
  })
}
