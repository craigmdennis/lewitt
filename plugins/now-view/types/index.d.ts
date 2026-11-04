export type RunStatus = 'running' | 'done' | 'stopped' | 'failed'

export type Run = {
  id: string
  type: string
  description: string
  brief: string
  status: RunStatus
  lastTool?: string
  toolCount: number
  startedAt: number
  endedAt?: number
  answer?: string
}

declare module 'claude-code' {
  interface PluginState {
    'now-view': {
      runs: Shaped<Run[]>
      selected: string | null
    }
  }
}
