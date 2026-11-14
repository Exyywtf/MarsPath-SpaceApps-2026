"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function Accordion({
  title, children, className = "", defaultOpen = false, open, onOpenChange, leadingAction,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  leadingAction?: ReactNode;
}) {
  const id = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const expanded = open ?? localOpen;
  const body = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null), animation = useRef<Animation | null>(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const node = body.current!, inner = content.current!;
    const from = node.getBoundingClientRect().height;
    animation.current?.cancel();
    if (!expanded && node.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    const to = expanded ? inner.getBoundingClientRect().height : 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => { node.style.height = expanded ? "auto" : "0px"; };
    if (!mounted.current || reduced.matches || Math.abs(from - to) < .5) finish();
    else {
      node.style.height = from + "px";
      const next = node.animate([{ height: from + "px" }, { height: to + "px" }], {
        duration: 200, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both",
      });
      animation.current = next;
      next.onfinish = () => { finish(); next.cancel(); animation.current = null; };
    }
    mounted.current = true;
    const reduce = () => { if (reduced.matches) { animation.current?.cancel(); finish(); } };
    reduced.addEventListener("change", reduce);
    return () => reduced.removeEventListener("change", reduce);
  }, [expanded]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);

  return (
    <section className={"accordion " + className} data-open={expanded}>
      <div className={"accordion-actions" + (leadingAction ? " has-leading-action" : "")}>
        {leadingAction}
        <h3 className="accordion-heading">
          <button ref={trigger} type="button" className="accordion-trigger" id={id + "-trigger"}
            aria-expanded={expanded} aria-controls={id + "-body"}
            onClick={() => { const next = !expanded; setLocalOpen(next); onOpenChange?.(next); }}>
            <span className="accordion-title">{title}</span><ChevronDown size={16} aria-hidden="true" />
          </button>
        </h3>
      </div>
      <div ref={body} className="accordion-body" id={id + "-body"} aria-labelledby={id + "-trigger"}
        inert={!expanded} aria-hidden={!expanded}>
        <div ref={content} className="accordion-content">{children}</div>
      </div>
    </section>
  );
}
