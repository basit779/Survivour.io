// XP required to advance FROM the given level to the next. Piecewise-linear,
// tuned for ~level 45-60 over a full 15-minute run.
export function xpToNext(level: number): number {
  if (level <= 20) return Math.round(5 + (level - 1) * 6)
  if (level <= 40) return Math.round(119 + (level - 20) * 13)
  return Math.round(379 + (level - 40) * 22)
}
