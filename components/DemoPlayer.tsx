"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { demo } from "@/lib/site";

function needsQuietVideo(video: HTMLVideoElement) {
  const { userAgent, maxTouchPoints } = navigator;
  if (/iPad|iPhone|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1)) return true;
  try {
    video.volume = 0.25;
    return video.volume !== 0.25;
  } catch {
    return true;
  }
}

function timeLabel(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

export default function DemoPlayer({ videoRef }: { videoRef?: RefObject<HTMLVideoElement | null> }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [time, setTime] = useState(0);
  const [volume, setVolume] = useState(25);
  const [muted, setMuted] = useState(false);
  const [deviceVolume, setDeviceVolume] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [feedbackHost, setFeedbackHost] = useState<HTMLElement | null>(null);

  const attach = useCallback((node: HTMLVideoElement | null) => {
    video.current = node;
    if (videoRef) videoRef.current = node;
    if (node) {
      setDeviceVolume(needsQuietVideo(node));
      setFeedbackHost(node.closest("dialog") ?? document.body);
    }
  }, [videoRef]);

  function error() {
    setPlaying(false);
    setLoading(false);
    setFailed(true);
  }

  function togglePlay() {
    const node = video.current;
    if (!node) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    setLoading(true);
    if (!node.hasAttribute("src") || failed) node.src = deviceVolume ? demo.quietVideo : demo.video;
    setFailed(false);
    node.play().catch((reason: DOMException) => {
      if (reason.name !== "AbortError") error();
    });
  }

  const playbackLabel = playing ? "Pause demo" : "Play demo";
  const soundLabel = muted ? "Unmute demo" : "Mute demo";
  return <section className="demo-player" aria-label="MarsPath demo player">
    <div className="demo-screen">
      <video ref={attach} poster={demo.poster} playsInline preload="none" aria-label="MarsPath Jezero mission video"
        onLoadedMetadata={() => setLoaded(true)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlaying={() => { setPlaying(true); setLoading(false); }}
        onPause={() => { setPlaying(false); setLoading(false); }}
        onError={error}
      />
    </div>
    <div className="demo-controls">
      <button type="button" className="icon-button" aria-label={playbackLabel} title={playbackLabel} onClick={togglePlay}>
        {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
      </button>
      <input type="range" className="demo-seek" min={0} max={demo.duration} step={0.1} disabled={!loaded}
        aria-label="Seek through demo" aria-valuetext={timeLabel(time)} value={Math.min(time, demo.duration)}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (video.current) video.current.currentTime = next;
          setTime(next);
        }} />
      <span className="demo-time">{timeLabel(time)} / {timeLabel(demo.duration)}</span>
      <button type="button" className="icon-button" aria-label={soundLabel} title={soundLabel} onClick={() => {
        if (video.current) video.current.muted = !muted;
        setMuted(!muted);
      }}>
        {muted || volume === 0 ? <VolumeX size={19} aria-hidden="true" /> : <Volume2 size={19} aria-hidden="true" />}
      </button>
      {deviceVolume ? <span className="demo-device-volume">Use device volume</span> :
        <input type="range" className="demo-volume" min={0} max={100} value={volume} aria-label="Demo volume"
          aria-valuetext={volume + "%"} onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (video.current) video.current.volume = next / 100;
            setVolume(next);
          }} />}
    </div>
    {feedbackHost && createPortal(<>
      <div className="floating-feedback demo-loading" data-visible={loading} aria-hidden="true">
        <span><LoaderCircle size={17} /> Loading demo…</span>
      </div>
      <span className="sr-only" role="status" aria-atomic="true">{loading ? "Loading demo…" : ""}</span>
    </>, feedbackHost)}
    {failed && <p className="demo-status" role="status">Playback failed. <a className="evidence-link" href={deviceVolume ? demo.quietVideo : demo.video}>Open the MP4</a></p>}
  </section>;
}
