"use client";

import { useId, useRef, useState } from "react";
import { Play } from "lucide-react";
import { demo } from "@/lib/site";
import AtlasDialog, { type DialogHandle } from "./AtlasDialog";
import DemoPlayer from "./DemoPlayer";

export default function DemoDialogTrigger() {
  const id = useId();
  const dialog = useRef<DialogHandle>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [openCount, setOpenCount] = useState(0);
  return <>
    <button type="button" aria-label="Watch demo" title="Watch demo" aria-haspopup="dialog"
      onClick={(event) => {
        setOpenCount((count) => count + 1);
        dialog.current?.open(event.currentTarget);
      }}>
      <Play size={18} aria-hidden="true" /><span>Watch demo</span>
    </button>
    <AtlasDialog ref={dialog} id={id} title={demo.title} closeLabel="Close demo" wide className="demo-dialog"
      onDismiss={() => video.current?.pause()}>
      <p className="demo-description">{demo.description}</p>
      {openCount > 0 && <DemoPlayer key={openCount} videoRef={video} />}
    </AtlasDialog>
  </>;
}
