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

test("a new chat lists the earlier tasks of its own project, and not another project's", async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  // The chat set its project in its transcript, as a resumed chat has.
  on('session.messages', () => ({
    value: [
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool: 'mcp__now-view__set_project', input: { name: 'ABC-1 · Billing page', goal: 'Show the next invoice.' } },
        ],
      },
    ],
  }))
  on('session.id', () => ({ value: 'chat-2' }))
  on('session.root', () => ({ value: '/project' }))
  on('store.get', (_, e) => ({
    value: e.key.startsWith('project:')
      ? [
          { name: 'ABC-1 · Billing page', goal: 'Show the next invoice.', at: 1, sessionId: 'chat-1' },
          { name: 'XYZ-9 · Other project', goal: 'Something else.', at: 2, sessionId: 'chat-9' },
        ]
      : e.key.startsWith('flags:')
        ? [{ id: 'F1', question: 'A question from the other project?', at: 2, sessionId: 'chat-9' }]
        : [
      {
        id: 'x9',
        type: 'copywriter',
        description: 'Copy for the other project',
        brief: 'Write it.',
        status: 'done',
        toolCount: 2,
        startedAt: Date.UTC(2026, 10, 3, 11, 0),
        endedAt: Date.UTC(2026, 10, 3, 11, 1),
        sessionId: 'chat-9',
      },
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
  expect((await ui.find({ type: 'Text', text: /BILLING PAGE/ }))?.text).toBe('ABC-1 · BILLING PAGE')
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (1)')
  expect((await ui.find({ text: /DESIGN PARTNER/ }))?.text).toContain('DESIGN PARTNER')
  expect(await ui.find({ type: 'Text', text: /other project/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /NEEDS YOU/ })).toBeUndefined()
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
  expect(await ui.find({ type: 'Text', text: /NEEDS YOU$/ })).toBeUndefined()
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
  expect(await ui.find({ type: 'Text', text: /NEEDS YOU$/ })).toBeUndefined()
  await ui.unmount()

  // "Done" in the pane clears a flag the design lead answered in the chat.
  await $.tool.call({
    tool: 'mcp__now-view__flag_for_design_lead',
    question: 'Should B move calls and texts into the credit pool?',
  })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'answered-F2' })
  expect(await ui.find({ type: 'Text', text: /NEEDS YOU$/ })).toBeUndefined()
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

  // A long step keeps to the card's two NOW rows.
  await $.tool.call({
    tool: 'Bash',
    command: 'ls',
    description:
      'Compare the toast copy with every usage alert, billing banner and limit message in the settings pages and the mobile app',
    agentId: 'a1',
  })
  const long = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const rows = await long.findAll({ type: 'Text', text: /^(Compare|.*…$|.*message)/ })
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.at(-1)?.text.endsWith('…')).toBe(true)
  await long.unmount()

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

test("the designer's turn shows its step while it runs, and its latest turn always has a finished row", async ($, on) => {
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'c1' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
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
  // The card shows the step, without the request the design lead wrote.
  expect(await ui.find({ type: 'Text', text: /^Make the usage/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^NOW$/ })).toBeUndefined()
  await ui.press({ key: 'designer-m1' })
  expect((await ui.find({ type: 'Text', text: /^YOUR REQUEST$/ }))?.text).toBe('YOUR REQUEST')
  expect((await ui.find({ type: 'Text', text: /^ANSWER TO YOU$/ }))?.text).toBe('ANSWER TO YOU')
  expect(await ui.find({ type: 'Text', text: /^Make the usage/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /DESIGN LEAD/ })).toBeUndefined()
  await ui.press({ key: 'back' })
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

  // The turn changed a file, so it is listed as finished.
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^RUNNING/ }))?.text).toBe('RUNNING (0)')
  expect((await ui.find({ type: 'Text', text: /^Nothing is running/ }))?.text).toBe('Nothing is running.')
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (1)')
  expect((await ui.find({ type: 'Text', text: /^1 file changed$/ }))?.text).toBe('1 file changed')
  expect((await ui.find({ type: 'Text', text: /^Version 2/ }))?.text).toBe('Version 2 is ready.')
  await ui.unmount()

  // A turn that only answers in the chat has a row until the next turn starts.
  await $.turn.start({ text: 'Why amber?', turnId: 'm2' })
  await $.turn.complete({
    answer: '**Amber** is the warning colour.\n\nMore detail.',
    durationMs: 1000,
    isAborted: false,
    turnId: 'm2',
    reason: 'answer',
  })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (2)')
  expect((await ui.find({ type: 'Text', text: /^Amber/ }))?.text).toBe('Amber is the warning colour.')
  await ui.unmount()
  // A turn that gives the team a task is listed, with the task in its view.
  await $.turn.start({ text: 'Get copy for the warning.', turnId: 'm3' })
  await $.agent.spawn({ prompt: 'Write the warning copy.', description: 'Warning copy', subagentType: 'copywriter' })
  await $.turn.complete({
    answer: 'The copywriter is on it.',
    durationMs: 1000,
    isAborted: false,
    turnId: 'm3',
    reason: 'answer',
  })

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (2)')
  expect(await ui.find({ type: 'Text', text: /^Why amber/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Amber/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^1 task for the team$/ }))?.text).toBe('1 task for the team')
  await ui.press({ key: 'designer-m3' })
  expect((await ui.find({ type: 'Text', text: /^COPYWRITER: / }))?.text).toBe('COPYWRITER: Warning copy')
  await ui.unmount()
})

test('the project summary shows at the top, and a new chat in the folder reads it from the store', async ($, on) => {
  const kept: Record<string, unknown> = {}
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('command.register', () => ({ value: { command: 'now' } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__now-view__${e.name}` } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('session.id', () => ({ value: 'chat-1' }))
  on('session.root', () => ({ value: '/project' }))
  on('store.get', (_, e) => ({ value: kept[e.key] }))
  on('store.set', (_, e) => {
    kept[e.key] = e.value
    return { value: undefined }
  })
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^NO PROJECT YET$/ }))?.text).toBe('NO PROJECT YET')
  await ui.unmount()

  const refused = await $.tool.call({ tool: 'mcp__now-view__set_project', stage: 'Scope' })
  expect(String(refused.result)).toContain('give a name and a goal')

  await $.tool.call({
    tool: 'mcp__now-view__set_project',
    name: 'ABC-1 · Billing page',
    goal: 'Show what the next invoice will be.',
    stage: 'Scope',
  })
  await $.tool.call({ tool: 'mcp__now-view__set_project', next: 'You pick one of two layouts.' })

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /BILLING PAGE/ }))?.text).toBe('ABC-1 · BILLING PAGE')
  expect((await ui.find({ type: 'Text', text: /next invoice/ }))?.text).toBe('Show what the next invoice will be.')
  // The stage and what comes next sit on the designer's latest row.
  expect(await ui.find({ type: 'Text', text: /two layouts/ })).toBeUndefined()
  await ui.unmount()

  await $.turn.start({ text: 'Build version 1.', turnId: 'm1' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^· SCOPE$/ }))?.text).toBe('· SCOPE')
  await ui.unmount()
  await $.turn.complete({ answer: 'Version 1 is ready.', durationMs: 1000, isAborted: false, turnId: 'm1', reason: 'answer' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^· SCOPE$/ }))?.text).toBe('· SCOPE')
  expect((await ui.find({ type: 'Text', text: /^Version 1/ }))?.text).toBe('Version 1 is ready.')
  expect((await ui.find({ type: 'Text', text: /two layouts/ }))?.text).toBe('You pick one of two layouts.')
  await ui.unmount()

  expect(Array.isArray(kept['project:/project'])).toBe(true)
})

test('the pane opens when the session starts and at the first prompt, and not again once it shows', async ($, on) => {
  const opened: string[] = []
  let placed = false
  on('command.register', () => ({ value: { command: 'now' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))
  on('ui.panes', () => ({
    value: placed ? [{ id: 'now-view', title: 'Now', isShown: true, isFocused: false, isPlaced: true }] : [],
  }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: false, reason: 'narrow' } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'Start a project for the billing page.' })
  expect(opened.length).toBe(2)

  placed = true
  await $.prompt.submit({ text: 'Next step.' })
  expect(opened.length).toBe(2)

})

test('/now clear removes the finished tasks of the project, and they stay removed', async ($, on) => {
  const kept: Record<string, unknown> = {
    'runs:/project': [
      {
        id: 'x9',
        type: 'copywriter',
        description: 'Copy for the other project',
        brief: 'Write it.',
        status: 'done',
        toolCount: 2,
        startedAt: Date.UTC(2026, 10, 3, 11, 0),
        endedAt: Date.UTC(2026, 10, 3, 11, 1),
        sessionId: 'chat-9',
        project: 'XYZ-9 · Other project',
      },
    ],
  }
  on('command.register', () => ({ value: { command: 'now' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'chat-2' }))
  on('session.root', () => ({ value: '/project' }))
  on('store.get', (_, e) => ({ value: kept[e.key] }))
  on('store.set', (_, e) => {
    kept[e.key] = e.value

    return { value: undefined }
  })
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
      : { value: [{ role: 'assistant', text: 'Most accounts use no credits.', toolUses: [] }] },
  )
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 4, 15, 0) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^FINISHED \(/ }))?.text).toBe('FINISHED (1)')
  await ui.unmount()

  const answer = await $.command.run({ command: 'now', args: 'clear' })
  expect(answer.text).toBe('Cleared 1 finished task from the Now pane.')
  // The other project's task stays in the store.
  expect((kept['runs:/project'] as { id: string }[]).map(one => one.id)).toEqual(['x9'])

  // /now reads the transcript again, and the cleared task stays removed.
  await $.command.run({ command: 'now' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^FINISHED \(/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Credit research/ })).toBeUndefined()
  await ui.unmount()
})
