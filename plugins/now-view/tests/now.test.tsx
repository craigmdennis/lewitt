import { expect, mock, test } from 'claude-code/testing'

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
  expect((await ui.find({ type: 'Text', text: /^F1, / }))?.text).toMatch(/^F1, \d\d:\d\d, COPYWRITER: Toast copy$/)
  await ui.unmount()

  const resolved = await $.tool.call({ tool: 'mcp__now-view__resolve_flag', id: 'F1' })
  expect(String(resolved.result)).toContain('F1 is cleared')
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
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
  expect((await ui.find({ type: 'Text', text: /Most accounts/ }))?.text).toContain('Most accounts use no credits.')
  expect((await ui.find({ type: 'Text', text: /^RESEARCHER finished/ }))?.text).toBe(
    'RESEARCHER finished: Credit research',
  )
  await ui.unmount()
})

test('a subagent shows as working, then finished with its answer', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  on('command.register', () => ({ value: { command: 'now' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', (_, e) => ({
    value:
      e.agentId === 'a1'
        ? [
            { role: 'user', text: 'Write the toast copy.', toolUses: [] },
            {
              role: 'assistant',
              text: 'The toast says Limit. The usage alerts say Usage.',
              toolUses: [{ tool_use_id: 'u1', tool: 'Bash', input: { command: 'rg toast' } }],
            },
          ]
        : [],
  }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))
  const asked: string[] = []
  on('model.complete', (_, e) => {
    asked.push(e.prompt)

    return {
      value: {
        isAnswered: true,
        text: 'Rewriting the toast copy to match the usage alerts.',
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    }
  })
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 4, 15, 0) })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({
    prompt: 'Write the toast copy.',
    description: 'Toast copy',
    subagentType: 'copywriter',
  })
  await $.tool.call({ tool: 'Bash', command: 'rg toast', agentId: 'a1' })
  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/copy/Toast.mdx',
    old_string: 'Limit',
    new_string: 'Usage',
    agentId: 'a1',
  })

  const early = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await early.find({ type: 'Text', text: /^Getting started/ }))?.text).toBe('Getting started.')
  await early.unmount()

  await clock.advance(10000)
  expect(asked).toHaveLength(1)
  expect(asked[0]).toContain('Task: Toast copy')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^WORKING/ }))?.text).toBe('WORKING (1)')
    expect((await ui.find({ type: 'Text', text: /^Rewriting/ }))?.text).toBe(
      'Rewriting the toast copy to match the usage alerts.',
    )
    expect((await ui.find({ type: 'Text', text: /Toast\.mdx$/ }))?.text).toBe('copy/Toast.mdx')
    expect(await ui.find({ type: 'Text', text: /^Bash: / })).toBeUndefined()
    await ui.unmount()
  }

  // No new work, no new summary.
  await clock.advance(10000)
  expect(asked).toHaveLength(1)

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
  expect((await ui.find({ type: 'Text', text: /^Changed / }))?.text).toBe('Changed copy/Toast.mdx')
  await ui.press({ key: 'a1' })
  expect((await ui.find({ type: 'Text', text: /^BRIEF/ }))?.text).toBe('BRIEF FROM THE DESIGNER')
  expect((await ui.find({ type: 'Text', text: /^FINISHED IN/ }))?.text).toBe('FINISHED IN 20 SEC')
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
  expect((await ui.find({ type: 'Text', text: /STARTED EARLIER/ }))?.text).toContain('FIRST SEEN')
  await ui.press({ key: 'a9' })
  expect((await ui.find({ type: 'Markdown', text: /codebase report/ }))?.text).toBe(
    'Write the codebase report.',
  )
  await ui.unmount()
})

test("the designer's own turn shows as a card, then in the activity", async ($, on) => {
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
  expect((await ui.find({ type: 'Text', text: /^WORKING/ }))?.text).toBe('WORKING (1)')
  expect((await ui.find({ type: 'Text', text: /^DESIGNER$/ }))?.text).toBe('DESIGNER')
  expect((await ui.find({ type: 'Text', text: /^Make the usage/ }))?.text).toBe(
    'Make the usage bar amber at 80%.',
  )
  expect((await ui.find({ type: 'Text', text: /usage\.tsx$/ }))?.text).toBe('src/usage.tsx')
  await ui.unmount()

  await $.turn.complete({
    answer: 'Version 2 is ready.',
    durationMs: 1000,
    isAborted: false,
    turnId: 'm1',
    reason: 'answer',
  })

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^WORKING/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^FINISHED \(/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^DESIGNER finished/ }))?.text).toBe(
    'DESIGNER finished: Make the usage bar amber at 80%.',
  )
  await ui.unmount()
})
