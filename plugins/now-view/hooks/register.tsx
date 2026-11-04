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

const MARK: Record<RunStatus, string> = {
  running: '>',
  done: '-',
  stopped: 'x',
  failed: '!',
}

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
      return (
        <Box flexDirection="column">
          <Button key="back" hotkey="b" onPress={() => update($, selected, () => null)}>
            Back
          </Button>
          <Text bold>
            {open.type}: {open.description}
          </Text>
          <Text dimColor>
            {open.status}, started {clockTime(open.startedAt)}
            {open.endedAt ? `, took ${duration(open.endedAt - open.startedAt)}` : ''}, {open.toolCount} tool calls
          </Text>
          {open.lastTool && <Text dimColor>Latest: {open.lastTool}</Text>}
          <Text bold>Brief</Text>
          <Markdown text={open.brief} />
          <Text bold>Answer</Text>
          {open.answer ? <Markdown text={open.answer} /> : <Text dimColor>Still working.</Text>}
        </Box>
      )
    }

    const running = list.filter(one => one.status === 'running')
    const finished = list.filter(one => one.status !== 'running').reverse()

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No subagents have run in this session.</Text>}
        {running.length > 0 && <Text bold>Working</Text>}
        {running.map(run => (
          <Box key={run.id} flexDirection="column">
            <Button key={run.id} plain onPress={() => update($, selected, () => run.id)}>
              {MARK[run.status]} {run.type}: {run.description}{' '}
              <Text dimColor>since {clockTime(run.startedAt)}</Text>
            </Button>
            <Text dimColor>
              {'  '}
              {run.lastTool ?? 'Starting'}
            </Text>
          </Box>
        ))}
        {finished.length > 0 && <Text bold>Finished</Text>}
        {finished.map(run => (
          <Button key={run.id} plain onPress={() => update($, selected, () => run.id)}>
            {MARK[run.status]} {run.type}: {run.description}{' '}
            <Text dimColor>
              {run.status}
              {run.endedAt ? `, ${duration(run.endedAt - run.startedAt)}` : ''}
            </Text>
          </Button>
        ))}
      </Box>
    )
  })
}
