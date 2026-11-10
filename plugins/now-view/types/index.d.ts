export type RunStatus = 'running' | 'done' | 'stopped' | 'failed'

export type Run = {
  id: string
  type: string
  description: string
  brief: string
  status: RunStatus
  lastTool?: string
  // The tool calls before the latest one, oldest first, at most a few.
  recent?: string[]
  toolCount: number
  // For a run the plugin found already working or finished, when the plugin
  // first saw it.
  startedAt: number
  // True when the run started before the plugin loaded, as at /reload-plugins.
  seenLate?: boolean
  endedAt?: number
  // How long the run took, from the main transcript, for a run that finished
  // before the plugin loaded.
  durationMs?: number
  answer?: string
  // The files the task wrote or edited, in the order it first changed them.
  changed?: string[]
  // For a designer turn: the tasks it gave the team, and how many questions it
  // flagged for the design lead.
  spawned?: string[]
  flagged?: number
  // The chat the run belongs to, so a later chat in the project lists it as
  // history.
  sessionId?: string
}

// A question or decision the designer flagged for the design lead.
export type Flag = {
  // F1, F2 and on, through the project's history.
  id: string
  question: string
  // The task the question comes from, when it comes from one.
  agentId?: string
  at: number
  resolvedAt?: number
}

// What the project is, for a design lead who comes back after a few days. The
// designer sets it with set_project at the start and at each stage.
export type Project = {
  // The issue and the project's name, such as "ABC-123 · Billing page".
  name: string
  // One sentence on what the project is doing.
  goal: string
  stage?: string
  // What happens next, or what waits on the design lead.
  next?: string
  // The latest prototype or document to open.
  link?: string
  at: number
  // The chat that set it, so each chat in the folder shows its own project.
  sessionId?: string
}

declare module 'claude-code' {
  interface PluginState {
    'now-view': {
      runs: Shaped<Run[]>
      flags: Shaped<Flag[]>
      selected: string | null
      project: Shaped<Project | null>
      // True once the design lead closed the pane in this chat, so it does not
      // open again on its own.
      dismissed: boolean
    }
  }
}
