export function scrollbarGeometry(viewport: number, extent: number, offset: number, track: number) {
  const maximum = Math.max(0, extent - viewport);
  const size = extent > 0 ? Math.min(track, Math.max(44, track * viewport / extent)) : track;
  const travel = Math.max(0, track - size);
  return {
    overflow: maximum > 1,
    size,
    maximum,
    position: maximum ? travel * Math.max(0, Math.min(1, offset / maximum)) : 0,
    scrollPerPixel: travel ? maximum / travel : 0,
  };
}
