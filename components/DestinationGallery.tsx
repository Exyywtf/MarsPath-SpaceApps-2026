"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GalleryImage } from "@/lib/gallery";
import EvidenceLink from "./EvidenceLink";

const reduceQuery = "(prefers-reduced-motion: reduce)";
const dwellMs = 6000;
const subscribeMotion = (update: () => void) => {
  const query = window.matchMedia(reduceQuery);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
};
const subscribeVisibility = (update: () => void) => {
  document.addEventListener("visibilitychange", update);
  return () => document.removeEventListener("visibilitychange", update);
};

export default function DestinationGallery({ images, title, active }: {
  images: readonly GalleryImage[];
  title: string;
  active: boolean;
}) {
  const count = images.length;
  // Four physical slides leave room for Embla to reposition a two-image loop.
  const slides = count === 2 ? [...images, ...images] : images;
  const [viewport, embla] = useEmblaCarousel({ align: "start", loop: count > 1, watchFocus: false,
    watchDrag: count > 1, inViewThreshold: 0.5, duration: 18, breakpoints: { [reduceQuery]: { duration: 0 } } });
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(true);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [hovered, setHovered] = useState(false), [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const stage = useRef<HTMLDivElement>(null);
  const pointerDown = useRef(false);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(reduceQuery).matches, () => false);
  const pageShown = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.6), { threshold: 0.6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!embla) return;
    const select = () => setIndex(embla.selectedScrollSnap());
    const updateCaption = () => {
      const visible = embla.slidesInView();
      if (!visible.length) return;
      const frame = embla.rootNode().getBoundingClientRect();
      const slides = embla.slideNodes();
      let best = visible[0], width = 0;
      for (const i of visible) {
        const slide = slides[i].getBoundingClientRect();
        const overlap = Math.min(frame.right, slide.right) - Math.max(frame.left, slide.left);
        if (overlap > width) { best = i; width = overlap; }
      }
      if (width > 0) setVisibleIndex(best);
    };
    const pause = () => setPlaying(false);
    embla.on("select", select).on("reInit", select).on("slidesInView", updateCaption).on("pointerDown", pause);
    return () => {
      embla.off("select", select).off("reInit", select).off("slidesInView", updateCaption).off("pointerDown", pause);
    };
  }, [embla]);

  const current = index % count;
  const next = images[(current + 1) % count];
  const rotating = active && visible && pageShown && !hovered && !reduced && playing;
  useEffect(() => {
    if (count < 2 || !embla || !rotating || !next || !loaded.has(next.id)) return;
    const timer = window.setTimeout(() => embla.scrollNext(), dwellMs);
    return () => window.clearTimeout(timer);
  }, [embla, count, rotating, index, loaded, next]);

  if (!count) return null;
  const displayed = (reduced ? index : visibleIndex) % count;
  const move = (direction: -1 | 1) => {
    setPlaying(false);
    if (direction === -1) embla?.scrollPrev(reduced);
    else embla?.scrollNext(reduced);
  };

  return (
    <section className="location-visual destination-gallery" role="region" aria-roledescription="carousel" aria-label={`${title} imagery`}
      data-slide={displayed + 1} data-rotating={rotating && count > 1}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onPointerDownCapture={() => { pointerDown.current = true; }}
      onPointerUpCapture={() => { pointerDown.current = false; }}
      onPointerCancelCapture={() => { pointerDown.current = false; }}
      onFocusCapture={(event) => {
        if (!pointerDown.current || event.target.matches(":focus-visible")) setPlaying(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}>
      <div className="gallery-stage" ref={stage}>
        {count > 1 && <button className="icon-button gallery-play" type="button" disabled={reduced}
          aria-label={playing && !reduced ? "Pause image rotation" : "Play image rotation"}
          onClick={() => setPlaying((old) => !old)}>
          {playing && !reduced ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>}
        <div className="gallery-viewport" ref={viewport}>
          <div className="gallery-track">
            {slides.map((item, position) => {
              const logical = position % count;
              const warm = logical === current || logical === (current + 1) % count || logical === (current + count - 1) % count;
              return <div className="gallery-slide" key={`${item.id}-${position}`} role="group" aria-roledescription="slide"
                aria-label={`${logical + 1} of ${count}`} aria-hidden={position !== (reduced ? index : visibleIndex)}>
                {warm && <Image className="location-image" src={item.asset} width={item.width} height={item.height} alt={item.caption}
                  loading="eager" draggable={false} onLoad={() => setLoaded((old) => old.has(item.id) ? old : new Set([...old, item.id]))} />}
              </div>;
            })}
          </div>
        </div>
        {count > 1 && <>
          <button className="icon-button gallery-arrow gallery-previous" type="button" disabled={!embla} aria-label="Previous image" onClick={() => move(-1)}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button className="icon-button gallery-arrow gallery-next" type="button" disabled={!embla} aria-label="Next image" onClick={() => move(1)}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
          <span className="gallery-count" aria-hidden="true">{displayed + 1} / {count}</span>
        </>}
      </div>
      <div className="gallery-caption" aria-live={rotating ? "off" : "polite"}>
        {images.map((item, position) => (
          <div key={item.id} className="gallery-caption-item" aria-hidden={position !== displayed}>
            <p className="gallery-title">{item.title}</p>
            <p>{item.caption}</p>
            <p className="gallery-credit">{item.imageType} · {item.credit}</p>
            <EvidenceLink href={item.sourcePage} target="_blank" rel="noreferrer">Original image source</EvidenceLink>
          </div>
        ))}
      </div>
    </section>
  );
}
