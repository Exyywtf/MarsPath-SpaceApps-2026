"use client";

import {
  useEffect, useImperativeHandle, useRef,
  type HTMLAttributes, type PointerEvent, type ReactNode, type Ref, type RefObject,
} from "react";
import { scrollbarGeometry } from "@/lib/scrollbar";

type Axis = "vertical" | "horizontal";
type Geometry = ReturnType<typeof scrollbarGeometry>;
const axes: Axis[] = ["vertical", "horizontal"];
const idleDelay = 1000;

function useIndicators({
  viewport, content, root = false, active = true,
}: {
  viewport?: RefObject<HTMLDivElement | null>;
  content?: RefObject<HTMLDivElement | null>;
  root?: boolean;
  active?: boolean;
}) {
  const tracks = useRef<Partial<Record<Axis, HTMLDivElement | null>>>({});
  const thumbs = useRef<Partial<Record<Axis, HTMLDivElement | null>>>({});
  const controller = useRef<{
    reveal: () => void;
    measure: () => void;
    drag?: { axis: Axis; pointer: number; origin: number; offset: number };
    geometries: Partial<Record<Axis, Geometry>>;
    node?: HTMLElement;
  }>({ reveal: () => {}, measure: () => {}, geometries: {} });

  useEffect(() => {
    const node = root ? document.scrollingElement as HTMLElement : viewport?.current;
    const container = root ? document.documentElement : node?.parentElement;
    if (!node || !container || !active) return;
    const current = controller.current;
    current.node = node;
    let frame = 0, timer = 0, visible = false, deadline = 0, scrolled = false;
    let right = 0, bottom = 0;
    const offsets: Partial<Record<Axis, number>> = {};
    function setVisible(show: boolean) {
      if (show === visible) return;
      visible = show;
      for (const axis of axes) {
        const track = tracks.current[axis];
        if (track) track.dataset.visible = String(show);
      }
    }
    function checkIdle() {
      timer = 0;
      if (current.drag) return;
      const remaining = deadline - performance.now();
      if (remaining > 0) timer = window.setTimeout(checkIdle, remaining);
      else setVisible(false);
    }
    function reveal() {
      if (!axes.some((axis) => current.geometries[axis]?.overflow)) return;
      deadline = performance.now() + idleDelay;
      setVisible(true);
      if (!timer) timer = window.setTimeout(checkIdle, idleDelay);
    }
    function measure() {
      frame = 0;
      const rect = root ? { right: innerWidth, bottom: innerHeight } : node!.getBoundingClientRect();
      right = rect.right;
      bottom = rect.bottom;
      let moved = false;
      for (const axis of axes) {
        const track = tracks.current[axis], thumb = thumbs.current[axis];
        if (!track || !thumb) continue;
        const vertical = axis === "vertical";
        const offset = vertical ? node!.scrollTop : node!.scrollLeft;
        const geometry = scrollbarGeometry(
          root ? (vertical ? innerHeight : innerWidth) : (vertical ? node!.clientHeight : node!.clientWidth),
          vertical ? node!.scrollHeight : node!.scrollWidth,
          offset,
          vertical ? track.clientHeight : track.clientWidth,
        );
        const previous = current.geometries[axis];
        // Content can clamp or anchor the scroll offset during a resize.
        moved ||= geometry.overflow && previous?.maximum === geometry.maximum && offsets[axis] !== offset;
        offsets[axis] = offset;
        current.geometries[axis] = geometry;
        if (geometry.overflow !== previous?.overflow) track.dataset.overflow = String(geometry.overflow);
        if (!geometry.overflow) continue;
        if (vertical) {
          thumb.style.height = geometry.size + "px";
          thumb.style.transform = "translateY(" + geometry.position + "px)";
        } else {
          thumb.style.width = geometry.size + "px";
          thumb.style.transform = "translateX(" + geometry.position + "px)";
        }
      }
      if (scrolled && moved) reveal();
      scrolled = false;
      if (!axes.some((axis) => current.geometries[axis]?.overflow)) setVisible(false);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const scroll = () => { scrolled = true; schedule(); };
    const key = (event: KeyboardEvent) => {
      if (["Tab", " ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key))
        reveal();
    };
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (event.clientX >= right - 24 || tracks.current.horizontal && event.clientY >= bottom - 24)
        reveal();
    };
    const enter = () => { schedule(); reveal(); };
    const scrollTarget = root ? window : node;
    const eventTarget = root ? document.documentElement : container;
    scrollTarget.addEventListener("scroll", scroll, { passive: true });
    scrollTarget.addEventListener("wheel", reveal, { passive: true });
    eventTarget.addEventListener("keydown", key);
    eventTarget.addEventListener("pointerenter", enter);
    eventTarget.addEventListener("pointermove", move, { passive: true });
    const trackElements = axes.map((axis) => tracks.current[axis]).filter((element) => !!element);
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    const inner = root ? document.body : content?.current;
    if (inner) observer.observe(inner);
    window.addEventListener("resize", schedule);
    current.reveal = reveal;
    current.measure = schedule;
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      scrollTarget.removeEventListener("scroll", scroll);
      scrollTarget.removeEventListener("wheel", reveal);
      eventTarget.removeEventListener("keydown", key);
      eventTarget.removeEventListener("pointerenter", enter);
      eventTarget.removeEventListener("pointermove", move);
      const drag = current.drag;
      current.drag = undefined;
      for (const track of trackElements) {
        if (drag && track.hasPointerCapture(drag.pointer)) track.releasePointerCapture(drag.pointer);
      }
      setVisible(false);
      current.geometries = {};
      current.reveal = () => {};
      current.measure = () => {};
      current.node = undefined;
    };
  }, [viewport, content, root, active]);

  function start(axis: Axis, event: PointerEvent<HTMLDivElement>) {
    const current = controller.current;
    const geometry = current.geometries[axis], node = current.node;
    if (!event.isPrimary || event.button !== 0 || !geometry?.overflow || !node) return;
    event.preventDefault();
    current.reveal();
    const coordinate = axis === "vertical" ? event.clientY : event.clientX;
    const offset = axis === "vertical" ? node.scrollTop : node.scrollLeft;
    if ((event.target as Element).closest(".scroll-thumb")) {
      current.drag = { axis, pointer: event.pointerId, origin: coordinate, offset };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = coordinate - (axis === "vertical" ? rect.top : rect.left);
      const direction = position < geometry.position ? -1 : 1;
      const page = axis === "vertical" ? node.clientHeight : node.clientWidth;
      if (axis === "vertical") node.scrollTop += direction * page * 0.9;
      else node.scrollLeft += direction * page * 0.9;
    }
  }
  function drag(event: PointerEvent<HTMLDivElement>) {
    const current = controller.current;
    const drag = current.drag, node = current.node;
    if (!drag || !node || drag.pointer !== event.pointerId) return;
    const geometry = current.geometries[drag.axis]!;
    const coordinate = drag.axis === "vertical" ? event.clientY : event.clientX;
    const position = Math.max(0, Math.min(geometry.maximum,
      drag.offset + (coordinate - drag.origin) * geometry.scrollPerPixel));
    if (drag.axis === "vertical") node.scrollTop = position;
    else node.scrollLeft = position;
    current.reveal();
    current.measure();
  }
  function stop(event: PointerEvent<HTMLDivElement>) {
    const current = controller.current;
    if (current.drag?.pointer !== event.pointerId) return;
    current.drag = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    current.reveal();
  }
  return function indicator(axis: Axis) {
    return (
      <div className="scroll-track" data-axis={axis} data-visible="false" data-overflow="false"
        aria-hidden="true"
        ref={(node) => { tracks.current[axis] = node; }}
        onPointerDown={(event) => start(axis, event)}
        onPointerMove={drag} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        <div className="scroll-thumb" ref={(node) => { thumbs.current[axis] = node; }} />
      </div>
    );
  };
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  viewportRef?: Ref<HTMLDivElement>;
  viewportClassName?: string;
  contentClassName?: string;
  viewportProps?: HTMLAttributes<HTMLDivElement>;
  axis?: "vertical" | "horizontal" | "both";
  active?: boolean;
  label: string;
}

export default function ScrollArea({
  children, viewportRef, viewportClassName = "", contentClassName = "",
  viewportProps, axis = "vertical", active = true, label, className = "", ...props
}: Props) {
  const viewport = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  useImperativeHandle(viewportRef, () => viewport.current!, []);
  const indicator = useIndicators({ viewport, content, active });
  return (
    <div className={"scroll-area " + className} {...props}>
      <div {...viewportProps} ref={viewport} tabIndex={0} role="region" aria-label={label}
        className={"scroll-viewport " + viewportClassName}>
        <div ref={content} className={"scroll-content " + contentClassName}>{children}</div>
      </div>
      {axis !== "horizontal" && indicator("vertical")}
      {axis !== "vertical" && indicator("horizontal")}
    </div>
  );
}

export function DocumentScrollbars() {
  const indicator = useIndicators({ root: true });
  return <div className="document-scrollbars">{indicator("vertical")}</div>;
}
