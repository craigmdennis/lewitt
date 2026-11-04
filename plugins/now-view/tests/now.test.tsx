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

test('a subagent shows as working, then finished with its answer', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  on('command.register', () => ({ value: { command: 'now' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
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
  await $.tool.call({ tool: 'Read', file_path: '/repo/Toast.mdx', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Working/ }))?.text).toBe('Working')
    expect((await ui.find({ type: 'Text', text: /Read/ }))?.text).toContain('Read: /repo/Toast.mdx')
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
  expect((await ui.find({ type: 'Text', text: /Finished/ }))?.text).toBe('Finished')
  await ui.press({ key: 'a1' })
  expect((await ui.find({ type: 'Text', text: /Brief/ }))?.text).toBe('Brief')
  await ui.unmount()
})
