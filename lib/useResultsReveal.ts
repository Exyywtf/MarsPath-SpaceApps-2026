"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useResultsReveal({
  pending, generation, directions, placement, expand,
}: {
  pending: boolean;
  generation?: number;
  directions: boolean;
  placement: boolean;
  expand: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const attachScroll = useCallback((node: HTMLDivElement | null) => { scroll.current = node; }, []);
  const awaiting = useRef(false);
  const interrupted = useRef(false);
  const handled = useRef<number | undefined>(undefined);
  const job = useRef(0);
  const [collapsed, setCollapsed] = useState(false);
  const interrupt = useCallback(() => {
    if (awaiting.current) interrupted.current = true;
    if (job.current) {
      cancelAnimationFrame(job.current);
      job.current = 0;
    }
    // Native smooth scrolling is independently interruptible by scroll input.
  }, []);
  const scrollTo = useCallback(() => {
    cancelAnimationFrame(job.current);
    job.current = requestAnimationFrame(() => {
      job.current = 0;
      if (!scroll.current) return;
      const panel = scroll.current;
      const heading = panel.querySelector("#compare-routes");
      if (!heading) return;
      const top = heading.getBoundingClientRect().top -
        panel.getBoundingClientRect().top + panel.scrollTop - 20;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
    });
  }, []);
  useLayoutEffect(() => {
    if (pending) {
      cancelAnimationFrame(job.current);
      if (!awaiting.current) interrupted.current = false;
      awaiting.current = true;
      return;
    }
    const mayReveal = awaiting.current && !interrupted.current && directions && !placement;
    awaiting.current = false;
    if (!generation || handled.current === generation) return;
    handled.current = generation;
    const active = document.activeElement;
    if (!mayReveal || active?.matches('input, textarea, select, [contenteditable="true"]')) return;
    // The collapsed form stays mounted; do not hide the currently focused control.
    job.current = requestAnimationFrame(() => {
      if (!active?.closest("#route-planning"))
        setCollapsed(true);
      expand();
      scrollTo();
    });
    return () => cancelAnimationFrame(job.current);
  }, [pending, generation, directions, placement, scrollTo, expand]);
  const view = useCallback(() => {
    expand();
    scrollTo();
  }, [expand, scrollTo]);
  const openEditors = useCallback(() => setCollapsed(false), []);
  const edit = useCallback(() => {
    interrupt();
    setCollapsed(false);
    requestAnimationFrame(() => {
      scroll.current?.scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("planning-heading")?.focus({ preventScroll: true });
    });
  }, [interrupt]);
  return [attachScroll, collapsed && !!generation && !placement, interrupt, view, edit, openEditors] as const;
}
