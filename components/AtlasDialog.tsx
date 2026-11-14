"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import { X } from "lucide-react";

export type DialogHandle = { open: (returnFocus?: HTMLElement | null) => void };

export default function AtlasDialog({
  ref, id, title, closeLabel, wide = false, children,
}: {
  ref?: Ref<DialogHandle>;
  id: string;
  title: string;
  closeLabel: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const outsidePress = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finishClosing = useCallback(() => {
    if (!dialog.current?.open) return;
    clearTimeout(timer.current);
    dialog.current.close();
    delete dialog.current.dataset.closing;
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    trigger.current = null;
  }, []);

  function dismiss() {
    const node = dialog.current;
    if (!node?.open || node.dataset.closing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClosing();
      return;
    }
    node.dataset.closing = "true";
    timer.current = setTimeout(finishClosing, 190);
  }

  useImperativeHandle(ref, () => ({
    open(returnFocus) {
      const node = dialog.current;
      if (!node) return;
      clearTimeout(timer.current);
      delete node.dataset.closing;
      if (node.open) return;
      trigger.current = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      node.showModal();
      close.current?.focus({ preventScroll: true });
    },
  }));

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (motion.matches && dialog.current?.dataset.closing) finishClosing();
    };
    motion.addEventListener("change", stop);
    return () => {
      clearTimeout(timer.current);
      motion.removeEventListener("change", stop);
    };
  }, [finishClosing]);

  return (
    <dialog
      ref={dialog}
      className={"atlas-dialog" + (wide ? " reference-dialog" : " help-dialog")}
      aria-labelledby={id}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onPointerDown={(event) => { outsidePress.current = event.target === dialog.current; }}
      onPointerCancel={() => { outsidePress.current = false; }}
      onClick={(event) => {
        if (event.target === dialog.current && outsidePress.current) dismiss();
        outsidePress.current = false;
      }}
    >
      <div className="dialog-surface">
        <header className="dialog-title">
          <h2 id={id}>{title}</h2>
          <button ref={close} className="icon-button" aria-label={closeLabel} onClick={dismiss}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog-content">{children}</div>
      </div>
    </dialog>
  );
}
