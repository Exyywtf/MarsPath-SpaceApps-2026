"use client";

import {
  useEffect, useImperativeHandle, useRef,
  type HTMLAttributes, type PointerEvent, type ReactNode, type Ref, type RefObject,
} from "react";
import { scrollbarGeometry } from "@/lib/scrollbar";

type Axis = "vertical" | "horizontal";
type Geometry = ReturnType<typeof scrollbarGeometry>;
const axes: Axis[] = ["vertical", "horizontal"];

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
    let frame = 0, timer = 0, overTrack = false;
    let right = 0, bottom = 0;
    function visible(show: boolean) {
      for (const axis of axes) {
        const track = tracks.current[axis];
        if (track) track.dataset.visible = String(show);
      }
    }
    function hideLater() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!current.drag && !overTrack) visible(false);
      }, 900);
    }
    function reveal() {
      visible(true);
      hideLater();
    }
    function measure() {
      frame = 0;
      const rect = root ? { right: innerWidth, bottom: innerHeight } : node!.getBoundingClientRect();
      right = rect.right;
      bottom = rect.bottom;
      for (const axis of axes) {
        const track = tracks.current[axis], thumb = thumbs.current[axis];
        if (!track || !thumb) continue;
        const vertical = axis === "vertical";
        const geometry = scrollbarGeometry(
          root ? (vertical ? innerHeight : innerWidth) : (vertical ? node!.clientHeight : node!.clientWidth),
          vertical ? node!.scrollHeight : node!.scrollWidth,
          vertical ? node!.scrollTop : node!.scrollLeft,
          vertical ? track.clientHeight : track.clientWidth,
        );
        current.geometries[axis] = geometry;
        track.dataset.overflow = String(geometry.overflow);
        if (vertical) {
          thumb.style.height = geometry.size + "px";
          thumb.style.transform = "translateY(" + geometry.position + "px)";
        } else {
          thumb.style.width = geometry.size + "px";
          thumb.style.transform = "translateX(" + geometry.position + "px)";
        }
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const scroll = () => { schedule(); reveal(); };
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
    const trackEnter = () => { overTrack = true; reveal(); };
    const trackLeave = () => { overTrack = false; hideLater(); };
    const scrollTarget = root ? window : node;
    const eventTarget = root ? document.documentElement : container;
    scrollTarget.addEventListener("scroll", scroll, { passive: true });
    eventTarget.addEventListener("keydown", key);
    eventTarget.addEventListener("pointerenter", enter);
    eventTarget.addEventListener("pointermove", move, { passive: true });
    const trackElements = axes.map((axis) => tracks.current[axis]).filter((element) => !!element);
    for (const track of trackElements) {
      track.addEventListener("pointerenter", trackEnter);
      track.addEventListener("pointerleave", trackLeave);
    }
    const observer = new ResizeObserver(() => { schedule(); reveal(); });
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
      eventTarget.removeEventListener("keydown", key);
      eventTarget.removeEventListener("pointerenter", enter);
      eventTarget.removeEventListener("pointermove", move);
      for (const track of trackElements) {
        track.removeEventListener("pointerenter", trackEnter);
        track.removeEventListener("pointerleave", trackLeave);
      }
      visible(false);
      current.drag = undefined;
      current.node = undefined;
    };
  }, [viewport, content, root, active]);

  function start(axis: Axis, event: PointerEvent<HTMLDivElement>) {
    const current = controller.current;
    const geometry = current.geometries[axis], node = current.node;
    if (!geometry?.overflow || !node) return;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    controller.current.drag = undefined;
    controller.current.reveal();
  }
  return function indicator(axis: Axis) {
    return (
      <div className="scroll-track" data-axis={axis} data-visible="false" data-overflow="false"
        aria-hidden="true"
        ref={(node) => { tracks.current[axis] = node; }}
        onPointerDown={(event) => start(axis, event)}
        onPointerMove={drag} onPointerUp={stop} onPointerCancel={stop}
        onLostPointerCapture={() => { controller.current.drag = undefined; }}>
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
