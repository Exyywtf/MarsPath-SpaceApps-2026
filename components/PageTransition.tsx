"use client";
import { useLayoutEffect, useRef, ViewTransition, type ReactNode } from "react";

function supportsNativeTransitions() {
  // The tested WebKit port crashes when a native transition snapshots the
  // OpenLayers canvas. Keep its CSS entry until that combination is validated.
  const webkit = /AppleWebKit/.test(navigator.userAgent) && !/(Chrome\/|Chromium\/|Edg\/|OPR\/)/.test(navigator.userAgent);
  return !webkit && typeof document.startViewTransition === "function" && CSS.supports("view-transition-class: page-enter");
}

export default function PageTransition({ children, page }: { children: ReactNode; page: string }) {
  const native = typeof document !== "undefined" && supportsNativeTransitions();
  const shell = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (shell.current) shell.current.dataset.pageMotion = native ? "native" : "entry"; }, [native]);
  // ViewTransition adds no DOM. Both server and client hydrate the same shell;
  // capability selection never reparents an already mounted atlas or worker.
  const content = <div className="page-shell" ref={shell}>{children}</div>;
  return native ? <ViewTransition key={page} name={"page-" + page} default="none"
    enter="page-enter" exit="page-exit">{content}</ViewTransition> : content;
}
