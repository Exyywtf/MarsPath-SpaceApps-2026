export type Rect = { x: number; y: number; width: number; height: number };
export type MapInsets = [top: number, right: number, bottom: number, left: number];
export type MapLayout = { viewport: Rect; overlays: Rect[]; insets: MapInsets; hudCovered: boolean };

export function intersects(a: Rect, b: Rect, clearance = 0) {
  return a.x < b.x + b.width + clearance && a.x + a.width + clearance > b.x &&
    a.y < b.y + b.height + clearance && a.y + a.height + clearance > b.y;
}
export function contains(outer: Rect, inner: Rect, clearance = 0) {
  return inner.x >= outer.x + clearance && inner.y >= outer.y + clearance &&
    inner.x + inner.width <= outer.x + outer.width - clearance &&
    inner.y + inner.height <= outer.y + outer.height - clearance;
}
export function deriveMapLayout(viewport: Rect, header: Rect, footer: Rect, panel: Rect | null,
  sidebar: boolean, edge: number, hudHeight: number, imageryHeight: number) {
  const right = edge, hudX = viewport.width - edge - 44;
  const panelIntersects = panel && panel.x < hudX + 44 && panel.x + panel.width > hudX;
  const hudBottom = panelIntersects ? panel.y - 12 : footer.y - 12;
  const hudTop = hudBottom - hudHeight;
  const hudCovered = hudTop < header.y + header.height + imageryHeight + 24;
  const insets: MapInsets = [header.y + header.height + 10, right + 52,
    panel && !sidebar ? viewport.height - panel.y + 10 : viewport.height - footer.y + 10,
    panel && sidebar ? panel.x + panel.width + 10 : edge + 10];
  return { hudTop, hudBottom, hudCovered, insets };
}
