export function coordinate(value: unknown, maximum: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= maximum ? number : null
}
export function longitudeBounds(values: number[]): [number, number] {
  if (!values.length) return [-180, 180]
  const sorted = values
    .map((value) => (value + 360) % 360)
    .sort((a, b) => a - b)
  let gap = -1,
    start = 0
  for (let i = 0; i < sorted.length; i++) {
    const distance =
      (i === sorted.length - 1 ? sorted[0]! + 360 : sorted[i + 1]!) - sorted[i]!
    if (distance > gap) {
      gap = distance
      start = (i + 1) % sorted.length
    }
  }
  const west = sorted[start]! > 180 ? sorted[start]! - 360 : sorted[start]!
  return [west, west + 360 - gap]
}

/** Keep polygon edges local when Natural Earth joins +180 to -180. */
export function unwrapRing(ring: number[][]): number[][] {
  let previous = ring[0]?.[0] ?? 0
  return ring.map((position) => {
    let longitude = position[0]!
    while (longitude - previous > 180) longitude -= 360
    while (longitude - previous < -180) longitude += 360
    previous = longitude
    return [longitude, ...position.slice(1)]
  })
}
