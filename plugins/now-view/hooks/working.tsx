import type { ClientModule } from 'claude-code'

// The mark of a task in progress, drawn by the surface on its own frame clock:
// a turning glyph, as on Claude Code's own working line, and the time since
// the task started, counting up.
const FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
const FRAME_MS = 120

type Props = { since: number | null }

function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)

  return minutes > 0 ? `${minutes}M ${String(seconds % 60).padStart(2, '0')}S` : `${seconds}S`
}

const Working: ClientModule<Props, number> = (props, surface) => {
  const { Text } = surface.elements
  if (surface.state === undefined) {
    let tick = 0
    surface.every(FRAME_MS, () => {
      tick += 1
      surface.setState(tick)
    })
    surface.setState(0)
  }
  const frame = FRAMES[(surface.state ?? 0) % FRAMES.length]
  const time = props.since === null ? '' : ` ${elapsed(Date.now() - props.since)}`

  return (
    <Text bold>
      {frame}
      {time}
    </Text>
  )
}

export default Working
