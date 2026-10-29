import type { Board } from '../../model/types'
export function TaperSheet({ onClose }: { board: Board; onClose(): void }) {
  return <button onClick={onClose}>Close</button>
}
