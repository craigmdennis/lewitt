import { expect, test } from 'claude-code/testing'

import { VERSION } from '../hooks/build'

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
  on('session.messages', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No tasks yet/ }))?.text).toBe('No tasks yet')
  expect((await ui.find({ type: 'Text', text: /shows here while it is in progress/ }))?.text).toContain(
    'such as the copywriter',
  )
  await ui.unmount()
})

test('the footer shows the version', async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^NOW VIEW/ }))?.text).toBe(`NOW VIEW ${VERSION}`)
  await ui.unmount()
})

test('a new chat lists the tasks of earlier chats in the project, with team names', async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('session.id', () => ({ value: 'chat-2' }))
  on('session.root', () => ({ value: '/project' }))
  on('store.get', () => ({
    value: [
      {
        id: 'f1',
        type: 'fork',
        description: 'Second option',
        brief: 'Build option B.',
        status: 'done',
        toolCount: 12,
        startedAt: Date.UTC(2026, 10, 3, 10, 0),
        endedAt: Date.UTC(2026, 10, 3, 10, 6),
        answer: 'Option B is built.',
        sessionId: 'chat-1',
      },
    ],
  }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (1)')
  expect((await ui.find({ text: /DESIGN PARTNER/ }))?.text).toContain('DESIGN PARTNER')
  expect((await ui.find({ type: 'Text', text: /^FINISHED IN 6 MIN/ }))?.text).toBe('FINISHED IN 6 MIN, NOV 3')
  await ui.unmount()
})

test('a flag from the designer shows at the top until it is resolved', async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__now-view__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'ghostty' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'c1' }))
  on('turn.complete', () => ({ text: '' }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /NEEDS YOU$/ }))?.text).toBe('NOTHING NEEDS YOU')
  await ui.unmount()

  await $.agent.spawn({ prompt: 'Write the toast copy.', description: 'Toast copy', subagentType: 'copywriter' })
  await $.turn.complete({
    agentId: 'c1',
    answer: 'Two options for the title.',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
  })
  const flagged = await $.tool.call({
    tool: 'mcp__now-view__flag_for_design_lead',
    question: 'Which toast title do you want, "Saved" or "Changes saved"?',
    agent_id: 'c1',
  })
  expect(String(flagged.result)).toContain('Flagged as F1')

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /THING NEEDS YOU$/ }))?.text).toBe('1 THING NEEDS YOU')
  expect((await ui.find({ type: 'Text', text: /toast title/ }))?.text).toContain('Changes saved')
  expect((await ui.find({ type: 'Text', text: /^- / }))?.text).toBe('- COPYWRITER')
  expect((await ui.find({ type: 'Text', text: /^Answer in the chat$/ }))?.text).toBe('Answer in the chat')
  expect(await ui.find({ type: 'Text', text: /F1/ })).toBeUndefined()
  await ui.unmount()

  const resolved = await $.tool.call({ tool: 'mcp__now-view__resolve_flag', id: 'F1' })
  expect(String(resolved.result)).toContain('F1 is cleared')
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /NEEDS YOU$/ }))?.text).toBe('NOTHING NEEDS YOU')
  await ui.unmount()

  // "Done" in the pane clears a flag the design lead answered in the chat.
  await $.tool.call({
    tool: 'mcp__now-view__flag_for_design_lead',
    question: 'Should B move calls and texts into the credit pool?',
  })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'answered-F2' })
  expect((await ui.find({ type: 'Text', text: /NEEDS YOU$/ }))?.text).toBe('NOTHING NEEDS YOU')
  await ui.unmount()
})

test('runs that finished before the plugin loaded show from the main transcript', async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', (_, e) =>
    e.agentId === undefined
      ? {
          value: [
            {
              role: 'assistant',
              text: '',
              toolUses: [
                {
                  tool_use_id: 'u1',
                  tool: 'Agent',
                  agentId: 'r1',
                  durationMs: 240000,
                  input: { description: 'Credit research', prompt: 'Find the evidence.', subagent_type: 'researcher' },
                },
              ],
            },
          ],
        }
      : {
          value: [
            { role: 'user', text: 'Find the evidence.', toolUses: [] },
            { role: 'assistant', text: 'Most accounts use no credits.\nMore detail.', toolUses: [] },
          ],
        },
  )
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (1)')
  expect((await ui.find({ type: 'Text', text: /^FINISHED IN/ }))?.text).toBe('FINISHED IN 4 MIN')
  expect(await ui.find({ type: 'Text', text: /Most accounts/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^Credit research$/ }))?.text).toBe('Credit research')
  await ui.unmount()
})

test('a subagent shows as working, then finished with its answer', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  on('command.register', () => ({ value: { command: 'now' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
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
  await $.tool.call({
    tool: 'Bash',
    command: 'rg toast',
    description: 'Find where the toast copy lives',
    agentId: 'a1',
  })

  const early = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await early.find({ type: 'Text', text: /^Find where/ }))?.text).toBe(
    'Find where the toast copy lives',
  )
  await early.unmount()

  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/copy/Toast.mdx',
    old_string: 'Limit',
    new_string: 'Usage',
    agentId: 'a1',
  })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^RUNNING/ }))?.text).toBe('RUNNING (1)')
    expect((await ui.find({ type: 'Text', text: /^Editing/ }))?.text).toBe('Editing Toast.mdx')
    // A file link is a link on the terminal and plain text where a surface
    // takes only https links.
    expect((await ui.find({ text: /^copy\/Toast\.mdx$/ }))?.text).toBe('copy/Toast.mdx')
    expect(await ui.find({ type: 'Text', text: /Bash/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /CALLS/ })).toBeUndefined()
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
  // The row holds the task and a link to the file it wrote, and the answer
  // shows only once the task is open.
  expect((await ui.find({ type: 'Link', text: /Toast\.mdx$/ }))?.text).toBe('copy/Toast.mdx')
  expect(await ui.find({ type: 'Text', text: /main card/ })).toBeUndefined()
  await ui.press({ key: 'a1' })
  expect((await ui.find({ type: 'Markdown', text: /main card/ }))?.text).toBe('Your main card was updated')
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
  expect((await ui.find({ type: 'Text', text: /^FRONT-END ENGINEER$/ }))?.text).toBe('FRONT-END ENGINEER')
  await ui.press({ key: 'a9' })
  expect((await ui.find({ type: 'Markdown', text: /codebase report/ }))?.text).toBe(
    'Write the codebase report.',
  )
  await ui.unmount()
})

test("the designer's own turn shows as a card while it runs", async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'Make the usage bar amber at 80%.\nThanks', turnId: 'm1' })
  await $.tool.call({
    tool: 'Edit',
    file_path: '/run/prototype/v2/src/usage.tsx',
    old_string: 'neutral',
    new_string: 'warning',
  })

  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^RUNNING/ }))?.text).toBe('RUNNING (1)')
  expect((await ui.find({ type: 'Text', text: /^DESIGNER$/ }))?.text).toBe('DESIGNER')
  expect((await ui.find({ type: 'Text', text: /^Make the usage/ }))?.text).toBe(
    'Make the usage bar amber at 80%.',
  )
  expect((await ui.find({ type: 'Text', text: /^Editing/ }))?.text).toBe('Editing usage.tsx')
  expect((await ui.find({ type: 'Link', text: /usage\.tsx$/ }))?.text).toBe('src/usage.tsx')
  await ui.unmount()

  await $.turn.complete({
    answer: 'Version 2 is ready.',
    durationMs: 1000,
    isAborted: false,
    turnId: 'm1',
    reason: 'answer',
  })

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^RUNNING/ }))?.text).toBe('RUNNING (0)')
  expect((await ui.find({ type: 'Text', text: /^Nothing is running/ }))?.text).toBe('Nothing is running.')
  expect(await ui.find({ type: 'Text', text: /^FINISHED \(/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^DESIGNER/ })).toBeUndefined()
  await ui.unmount()
})
