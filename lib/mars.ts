export const MARS_RADIUS = 3396190;
export type LonLat = [number, number];
export const radians = (d: number) => d * Math.PI / 180;
export const normalizeLon = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
export function marsDistance(a: LonLat, b: LonLat): number {
  const dl = radians(normalizeLon(b[0] - a[0]));
  const dp = radians(b[1] - a[1]);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dl / 2) ** 2;
  return 2 * MARS_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}
export const coordinateLabel = ([lon, lat]: LonLat, decimals = 3) => {
  const east = normalizeLon(lon);
  return `${Math.abs(lat).toFixed(decimals)}°${lat < 0 ? 'S' : 'N'}  ${Math.abs(east).toFixed(decimals)}°${east < 0 ? 'W' : 'E'}`;
};
export const projectedToLonLat = (x: number, y: number): LonLat => [x / MARS_RADIUS * 180 / Math.PI, y / MARS_RADIUS * 180 / Math.PI];
export const lonLatToProjected = ([lon, lat]: LonLat): LonLat => [radians(normalizeLon(lon)) * MARS_RADIUS, radians(lat) * MARS_RADIUS];
