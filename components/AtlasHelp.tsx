"use client";

import Link from "next/link";
import { ArrowUpRight, Layers, Route, Search } from "lucide-react";
import type { Ref } from "react";
import AtlasDialog, { type DialogHandle } from "./AtlasDialog";

const topics = [
  { name: "Explore Mars", icon: Search, text: "Open a destination to see its geology, missions and scientific sources." },
  { name: "Inspect scientific layers", icon: Layers, text: "Choose a layer, then select a point on the map to inspect its value or image coverage." },
  { name: "Plan a route", icon: Route, text: "Set A and B in Directions, compare the options and explore their profiles." },
];
const keys = [
  ["/", "Search places"], ["L", "Map layers"], ["R", "Directions"],
  ["A / B", "Place start / destination"],
  ["Enter", "Inspect or place a point on the focused map"],
  ["Arrow keys", "Pan the focused map"], ["+ / −", "Zoom the focused map"],
  ["Escape", "Cancel placement or close panel"], ["?", "Open this guide"],
];

export default function AtlasHelp({
  ref, keyboard, shortcuts, onShortcuts,
}: {
  ref: Ref<DialogHandle>;
  keyboard: boolean;
  shortcuts: boolean;
  onShortcuts: (value: boolean) => void;
}) {
  return (
    <AtlasDialog ref={ref} id="help-title" title="Your guide to MarsPath" closeLabel="Close help">
      <ol className="help-topics">
        {topics.map(({ name, icon: Icon, text }) => (
          <li key={name}>
            <Icon size={20} aria-hidden="true" />
            <div>
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="help-keyboard" data-keyboard={keyboard}>
        <h3>Keyboard shortcuts</h3>
        <dl className="shortcut-list">
          {keys.map(([key, action]) => (
            <div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>
          ))}
        </dl>
        <label className="layer-toggle">
          <span>Enable character shortcuts<small>Ignored while typing in a field.</small></span>
          <input type="checkbox" checked={shortcuts} onChange={(event) => onShortcuts(event.target.checked)} />
        </label>
      </section>
      <Link className="text-link" href="/methodology/">
        Read the methods <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </AtlasDialog>
  );
}
