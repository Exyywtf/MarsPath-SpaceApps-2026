export function reduceProfilePoints<T extends { value: number | null }>(points: T[]) {
  if (points.length < 200) return points;
  const indices = new Set([0, points.length - 1]);
  const step = Math.ceil(points.length / 100);
  let previousMissing = points[0].value === null;
  for (let start = 0; start < points.length; start += step) {
    let low: number | undefined, high: number | undefined;
    for (let i = start; i < Math.min(points.length, start + step); i++) {
      const value = points[i].value;
      const missing = value === null;
      if (missing !== previousMissing) {
        indices.add(i);
        if (i) indices.add(i - 1);
        previousMissing = missing;
      }
      if (value === null) continue;
      if (low === undefined || value < points[low].value!) low = i;
      if (high === undefined || value > points[high].value!) high = i;
    }
    if (low !== undefined) indices.add(low);
    if (high !== undefined) indices.add(high);
  }
  return [...indices].sort((a, b) => a - b).map((i) => points[i]);
}
