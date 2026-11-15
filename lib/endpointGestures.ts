import type Map from "ol/Map";
import MapBrowserEvent from "ol/MapBrowserEvent";
import type { Coordinate } from "ol/coordinate";
import { listen } from "ol/events";
import type { ListenerFunction } from "ol/events";
import { unByKey } from "ol/Observable";
import type { Pixel } from "ol/pixel";
import type { EndpointKind, Placement, PlannerDraft } from "./planner";
import type { LonLat } from "./mars";

export type RemovablePointKind = EndpointKind | "station";

const doubleTapWindow = 300;
const tapHoldLimit = 250;
const tapTravelLimit = 8;
const doubleTapTravelLimit = 18;

interface Session {
  draft: PlannerDraft;
  placement: Placement;
  station?: LonLat | null;
}

interface Tap {
  kind: RemovablePointKind;
  pixel: Pixel;
  time: number;
  session: Session;
}

function distance(a: Pixel, b: Pixel) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function installEndpointGestures(
  map: Map,
  hitEndpoint: (pixel: Pixel) => RemovablePointKind | undefined,
  readSession: () => Session,
  removeEndpoint: (kind: RemovablePointKind) => void,
  singleTap: (pixel: Pixel, coordinate: Coordinate) => void,
) {
  const viewport = map.getViewport();
  if (!viewport) return () => {};
  let mouseSecondary = false;
  let press: (Tap & { pointer: number }) | undefined;
  let pending: (Tap & { coordinate: Coordinate }) | undefined;
  let timer = 0;

  function inSession(session: Session) {
    const current = readSession();
    return session.draft === current.draft && session.placement === current.placement && session.station === current.station;
  }
  function clearTap() {
    window.clearTimeout(timer);
    timer = 0;
    pending = undefined;
  }
  function cancel() {
    press = undefined;
    clearTap();
  }
  function flushTap() {
    const tap = pending;
    clearTap();
    if (tap && inSession(tap.session)) singleTap(tap.pixel, tap.coordinate);
  }
  const down: ListenerFunction = (event) => {
    if (!(event instanceof MapBrowserEvent)) return;
    const pointer = event.originalEvent;
    if (!(pointer instanceof PointerEvent)) return;
    mouseSecondary = pointer.pointerType === "mouse" && pointer.button === 2;
    if (pointer.pointerType !== "touch" || !pointer.isPrimary || (event.activePointers?.length ?? 1) > 1) {
      cancel();
      return;
    }
    const kind = hitEndpoint(event.pixel);
    press = kind ? { kind, pixel: event.pixel, time: performance.now(), session: readSession(), pointer: pointer.pointerId } : undefined;
  };
  const up: ListenerFunction = (event) => {
    if (!(event instanceof MapBrowserEvent)) return;
    const pointer = event.originalEvent;
    if (!(pointer instanceof PointerEvent) || pointer.pointerType !== "touch") return;
    if (pointer.type === "pointercancel") {
      cancel();
      event.preventDefault();
      return;
    }
    const start = press;
    press = undefined;
    if (!start || start.pointer !== pointer.pointerId || event.activePointers?.length) return;
    // Keep this touch out of OpenLayers' click/zoom recognizer while resolving the endpoint tap.
    event.preventDefault();
    const time = performance.now(), pixel = event.pixel;
    if (time - start.time > tapHoldLimit || distance(start.pixel, pixel) > tapTravelLimit ||
        !inSession(start.session) || hitEndpoint(pixel) !== start.kind) return;
    if (pending?.kind === start.kind && inSession(pending.session) &&
        time - pending.time <= doubleTapWindow && distance(pending.pixel, pixel) <= doubleTapTravelLimit) {
      clearTap();
      removeEndpoint(start.kind);
      return;
    }
    flushTap();
    pending = { kind: start.kind, pixel, time, session: start.session, coordinate: event.coordinate };
    timer = window.setTimeout(flushTap, doubleTapWindow);
  };
  function contextMenu(event: MouseEvent) {
    const pointerType = (event as PointerEvent).pointerType;
    const fromMouse = pointerType ? pointerType === "mouse" : mouseSecondary;
    mouseSecondary = false;
    if (!fromMouse || event.button !== 2 || map.getOverlayContainerStopEvent()?.contains(event.target as Node)) return;
    const kind = hitEndpoint(map.getEventPixel(event));
    if (!kind) return;
    event.preventDefault();
    cancel();
    removeEndpoint(kind);
  }

  viewport.addEventListener("contextmenu", contextMenu);
  const keys = [listen(map, "pointerdown", down), listen(map, "pointerup", up), map.on("pointerdrag", cancel)];
  const viewKeys = map.getView().on(["change:center", "change:resolution"], cancel);
  return () => {
    cancel();
    unByKey(keys);
    unByKey(viewKeys);
    viewport.removeEventListener("contextmenu", contextMenu);
  };
}
