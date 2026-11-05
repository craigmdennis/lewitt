import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'now-view',
  component: 'Pane',
  requestId: 'now-view',
  props: {
    title: 'Now',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the empty pane says what will appear', async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No sub-agent tasks yet/ }))?.text).toBe(
    'No sub-agent tasks yet',
  )
  expect((await ui.find({ type: 'Text', text: /shows here while it runs/ }))?.text).toContain(
    'such as the copywriter',
  )
  await ui.unmount()
})

test('a subagent shows as working, then finished with its answer', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  on('command.register', () => ({ value: { command: 'now' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({
    prompt: 'Write the toast copy.',
    description: 'Toast copy',
    subagentType: 'copywriter',
  })
  await $.tool.call({ tool: 'Bash', command: 'rg toast', agentId: 'a1' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/Toast.mdx', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^WORKING/ }))?.text).toBe('WORKING (1)')
    expect((await ui.find({ type: 'Text', text: /^Read: / }))?.text).toBe('Read: /repo/Toast.mdx')
    expect((await ui.find({ type: 'Text', text: /^Bash: / }))?.text).toBe('Bash: rg toast')
    expect((await ui.find({ type: 'Text', text: /CALLS$/ }))?.text).toBe('2 CALLS')
    await ui.unmount()
  }

  await $.turn.complete({
    agentId: 'a1',
    answer: 'Your main card was updated',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (1)')
  await ui.press({ key: 'a1' })
  expect((await ui.find({ type: 'Text', text: /^BRIEF/ }))?.text).toBe('BRIEF FROM THE DESIGNER')
  expect((await ui.find({ type: 'Text', text: /^FINISHED IN/ }))?.text).toBe('FINISHED IN 0 SEC')
  await ui.unmount()
})

test('a run that started before the plugin loaded shows at its next tool call', async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({
    value: [
      { id: 'a9', description: 'Codebase report', type: 'frontend-engineer', status: 'running' },
    ],
  }))
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Write the codebase report.', toolUses: [] },
      {
        role: 'assistant',
        text: '',
        toolUses: [{ tool_use_id: 'u1', tool: 'Glob', input: { pattern: '**/*.ts' } }],
      },
    ],
  }))
  on('tool.call', () => ({ result: {} }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  // The agent was not in the list at session.start, as before a reload.
  await $.tool.call({ tool: 'Read', file_path: '/repo/billing.py', agentId: 'a9' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^Read: / }))?.text).toBe('Read: /repo/billing.py')
  expect((await ui.find({ type: 'Text', text: /^Glob: / }))?.text).toBe('Glob: **/*.ts')
  expect((await ui.find({ type: 'Text', text: /STARTED EARLIER/ }))?.text).toContain('FIRST SEEN')
  await ui.press({ key: 'a9' })
  expect((await ui.find({ type: 'Markdown', text: /codebase report/ }))?.text).toBe(
    'Write the codebase report.',
  )
  await ui.unmount()
})
