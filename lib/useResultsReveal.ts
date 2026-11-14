"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const editing = "input, textarea, select, [contenteditable=true]";

export function useResultsReveal({
  pending, generation, draftKey, directions, placement, expand,
}: {
  pending: boolean;
  generation?: number;
  draftKey: string;
  directions: boolean;
  placement: boolean;
  expand: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const attachScroll = useCallback((node: HTMLDivElement | null) => { scroll.current = node; }, []);
  const awaiting = useRef<string | null>(null);
  const interrupted = useRef(false);
  const handled = useRef<string | null>(null);
  const frame = useRef(0);
  const [collapsedFor, setCollapsedFor] = useState<string | null>(null);

  const interrupt = useCallback(() => {
    interrupted.current = true;
    cancelAnimationFrame(frame.current);
  }, []);
  const jump = useCallback((id: "compare-routes" | "planning-heading", focus = false) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const panel = scroll.current;
      const heading = panel?.querySelector<HTMLElement>("#" + id);
      if (!panel || !heading || panel.offsetHeight === 0) return;
      const start = panel.scrollTop;
      const target = Math.max(0, heading.getBoundingClientRect().top -
        panel.getBoundingClientRect().top + start - 20);
      if (focus) heading.focus({ preventScroll: true });
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const from = performance.now();
      const step = (now: number) => {
        const t = reduced.matches ? 1 : Math.min(1, (now - from) / 245);
        panel.scrollTop = start + (target - start) * (1 - (1 - t) ** 3);
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      if (reduced.matches) panel.scrollTop = target;
      else frame.current = requestAnimationFrame(step);
    });
  }, []);

  useLayoutEffect(() => {
    if (!directions || placement) interrupt();
  }, [directions, placement, interrupt]);
  useLayoutEffect(() => {
    if (pending) {
      if (awaiting.current !== draftKey) {
        cancelAnimationFrame(frame.current);
        interrupted.current = !directions || placement;
        awaiting.current = draftKey;
      }
      return;
    }
    const first = awaiting.current === draftKey && handled.current !== draftKey;
    awaiting.current = null;
    if (!generation || !first) return;
    handled.current = draftKey;
    const active = document.activeElement;
    if (interrupted.current || !directions || placement || active?.matches(editing)) return;
    frame.current = requestAnimationFrame(() => {
      const current = document.activeElement;
      if (interrupted.current || current?.matches(editing)) return;
      // Keep the form available while a control in it owns focus.
      if (!current?.closest("#route-planning")) setCollapsedFor(draftKey);
      expand();
      jump("compare-routes");
    });
  }, [pending, generation, draftKey, directions, placement, expand, jump]);
  useLayoutEffect(() => () => cancelAnimationFrame(frame.current), []);

  const view = useCallback(() => {
    expand();
    jump("compare-routes");
  }, [expand, jump]);
  const openEditors = useCallback(() => setCollapsedFor(null), []);
  const edit = useCallback(() => {
    interrupt();
    openEditors();
    jump("planning-heading", true);
  }, [interrupt, openEditors, jump]);
  return [attachScroll, collapsedFor === draftKey && !placement, interrupt, view, edit, openEditors] as const;
}
