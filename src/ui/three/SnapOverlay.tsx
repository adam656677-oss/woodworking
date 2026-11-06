import { Html, Line } from '@react-three/drei'
import type { SnapFeedback } from '../../model/snapFeedback'

const AMBER = '#d97706'
const BLUE = '#2563eb'

/** What the board being moved snapped to: highlighted faces, guide lines, a marker and a small label. */
export function SnapOverlay({ feedback }: { feedback: SnapFeedback }) {
  const { marker } = feedback
  return (
    <group name="snap-feedback" renderOrder={10}>
      {feedback.highlights.map((h, i) => {
        const size = (a: 'x' | 'y' | 'z') => (a === h.axis ? 0.04 : h.max[a] - h.min[a])
        return (
          <mesh key={`f${i}`} position={[(h.min.x + h.max.x) / 2, (h.min.y + h.max.y) / 2, (h.min.z + h.max.z) / 2]} renderOrder={10}>
            <boxGeometry args={[size('x'), size('y'), size('z')]} />
            <meshBasicMaterial color={AMBER} transparent opacity={0.3} depthTest={false} />
          </mesh>
        )
      })}
      {feedback.guides.map((g, i) => (
        <Line key={`g${i}`} points={[[g.from.x, g.from.y, g.from.z], [g.to.x, g.to.y, g.to.z]]} color={BLUE} lineWidth={1.5} dashed dashSize={0.5} gapSize={0.3} depthTest={false} />
      ))}
      {feedback.kind !== 'off' && (
        <mesh position={[marker.x, marker.y, marker.z]} renderOrder={11}>
          <sphereGeometry args={[feedback.kind === 'grid' ? 0.18 : 0.3, 12, 12]} />
          <meshBasicMaterial color={feedback.kind === 'grid' ? '#57534e' : AMBER} depthTest={false} />
        </mesh>
      )}
      <Html position={[marker.x, marker.y, marker.z]} style={{ pointerEvents: 'none' }}>
        <div role="status" aria-live="polite" data-testid="snap-feedback" data-snap-kind={feedback.kind}
          className="ml-3 -mt-8 whitespace-nowrap rounded bg-stone-900/85 px-2 py-1 text-xs text-white shadow">
          <div data-testid="snap-label" className="font-semibold">{feedback.label}</div>
          <div data-testid="snap-readout" className="text-[11px] text-stone-200">{feedback.readout}</div>
        </div>
      </Html>
    </group>
  )
}
