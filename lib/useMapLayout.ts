"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import { deriveMapLayout, type MapLayout, type Rect } from "./mapLayout";

export function useMapLayout(revision: string, onChange: () => void) {
  const root = useRef<HTMLElement>(null);
  const layout = useRef<MapLayout>({ viewport: { x: 0, y: 0, width: 0, height: 0 }, overlays: [], insets: [0, 0, 0, 0], hudCovered: false });
  const change = useRef(onChange);
  useLayoutEffect(() => { change.current = onChange; }, [onChange]);
  const measure = useCallback(() => {
    const host = root.current;
    if (!host) return layout.current;
    const base = host.getBoundingClientRect();
    const rect = (node: Element): Rect => {
      const r = node.getBoundingClientRect();
      return { x: r.x - base.x, y: r.y - base.y, width: r.width, height: r.height };
    };
    const header = host.querySelector('.topbar')!, footer = host.querySelector('.map-footer')!;
    const controls = host.querySelector<HTMLElement>('.map-controls')!, imagery = host.querySelector('.imagery-label')!;
    const panel = host.querySelector<HTMLElement>('.workflow-panel[data-open="true"]');
    if (!header || !footer || !controls || !imagery) return layout.current;
    const viewport = { x: 0, y: 0, width: base.width, height: base.height };
    const frame = deriveMapLayout(viewport, rect(header), rect(footer), panel ? rect(panel) : null,
      !!panel && getComputedStyle(panel).getPropertyValue('--side-panel').trim() === '1',
      Math.max(10, base.width - rect(header).x - rect(header).width), controls.offsetHeight, rect(imagery).height);
    host.style.setProperty('--hud-bottom', base.height - frame.hudBottom + 'px');
    host.dataset.hudCovered = String(frame.hudCovered);
    controls.inert = frame.hudCovered;
    const overlays = [...host.querySelectorAll('.topbar,.map-footer,.workflow-panel[data-open="true"],.imagery-label,.map-controls,.map-legend,.inspection-card,.placement-instruction,.route-feedback[data-visible="true"],.show-map')]
      .filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).map(rect);
    const next = { viewport, overlays, insets: frame.insets, hudCovered: frame.hudCovered };
    const previous = layout.current;
    const changed = previous.viewport.width !== base.width || previous.viewport.height !== base.height ||
      previous.overlays.length !== overlays.length || previous.overlays.some((r, i) => {
        const n = overlays[i]; return !n || r.x !== n.x || r.y !== n.y || r.width !== n.width || r.height !== n.height;
      });
    layout.current = next;
    if (changed) change.current();
    return next;
  }, []);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    const observer = new ResizeObserver(schedule);
    for (const node of host.querySelectorAll('.topbar,.map-footer,.workflow-panel,.imagery-label,.map-controls,.map-legend,.inspection-card,.route-feedback')) observer.observe(node);
    observer.observe(host);
    window.addEventListener('resize', schedule);
    schedule();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); };
  }, [root, revision, measure]);
  const read = useCallback(() => layout.current, []);
  return { root, read, measure };
}
