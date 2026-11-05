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

declare module 'claude-code' {
  interface PluginState {
    'now-view': {
      runs: Shaped<Run[]>
      flags: Shaped<Flag[]>
      selected: string | null
    }
  }
}
