import { contains, intersects, type MapLayout, type Rect } from "./mapLayout";

export type LabelPosition = "above" | "right" | "below" | "left";
export type LabelInput = { id: string; x: number; y: number; width: number; height: number; priority: number };
export type LabelPlacement = { position: LabelPosition; rect: Rect };
const positions: LabelPosition[] = ["above", "right", "below", "left"];
export function labelRect(label: LabelInput, position: LabelPosition): Rect {
  const { x, y, width, height } = label;
  return { x: position === "right" ? x + 14 : position === "left" ? x - 14 - width : x - width / 2,
    y: position === "above" ? y - 14 - height : position === "below" ? y + 14 : y - height / 2, width, height };
}
export function selectMapLabels(labels: LabelInput[], layout: Pick<MapLayout, "viewport" | "overlays">,
  previous: ReadonlyMap<string, LabelPlacement>, exiting: Rect[] = []) {
  const selected = new Map<string, LabelPlacement>();
  const occupied = [...exiting];
  for (const label of [...labels].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
    const retained = previous.get(label.id)?.position;
    const candidates = retained ? [retained, ...positions.filter((p) => p !== retained)] : positions;
    for (const position of candidates) {
      const rect = labelRect(label, position), clearance = position === retained ? 4 : 8;
      if (!contains(layout.viewport, rect, clearance) ||
        [...layout.overlays, ...occupied].some((other) => intersects(rect, other, clearance))) continue;
      selected.set(label.id, { position, rect });
      occupied.push(rect);
      break;
    }
  }
  return selected;
}
