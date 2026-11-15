import { MARS_RADIUS, normalizeLon, radians, type LonLat } from "./mars";

const degree = 180 / Math.PI;
const sin = (degrees: number) => Math.sin(radians(degrees));
const cos = (degrees: number) => Math.cos(radians(degrees));
const wrap = (value: number, cycle: number) => ((value % cycle) + cycle) % cycle;
const polarRadius = 3376200;
const latitudeRatio = (MARS_RADIUS / polarRadius) ** 2;
const meanSolDays = 1.0274912517;
const leapEpochs = [
  "1972-01-01", "1972-07-01", "1973-01-01", "1974-01-01", "1975-01-01", "1976-01-01",
  "1977-01-01", "1978-01-01", "1979-01-01", "1980-01-01", "1981-07-01", "1982-07-01",
  "1983-07-01", "1985-07-01", "1988-01-01", "1990-01-01", "1991-01-01", "1992-07-01",
  "1993-07-01", "1994-07-01", "1996-01-01", "1997-07-01", "1999-01-01", "2006-01-01",
  "2009-01-01", "2012-07-01", "2015-07-01", "2017-01-01",
].map((date) => Date.parse(date));
const leapLimit = Date.UTC(2027, 0, 1);
const perturbations = [
  [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.0020, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];
export const solarProvenance = {
  model: "NASA GISS Mars24 (2025-01-07 algorithm) · IERS Bulletin C 72",
  source: "https://www.giss.nasa.gov/tools/mars24/help/algorithm.html",
  clockSource: "https://datacenter.iers.org/data/html/bulletinc-072.html",
  validity: "Earth UTC from 1972 through 2026",
  limitation: "Geometric horizon. Surface relief, shadows and atmospheric extinction remain unassessed.",
};

export function utcFromInput(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(value)) return null;
  const time = Date.parse(value + "Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, value.length) === value ? time : null;
}

export function terrestrialOffset(utcMs: number) {
  if (!Number.isFinite(utcMs) || utcMs < leapEpochs[0] || utcMs >= leapLimit) return null;
  let i = leapEpochs.length - 1;
  while (utcMs < leapEpochs[i]) i--;
  return 42.184 + i;
}

export function planetographicLatitude(centric: number) {
  return Math.atan2(latitudeRatio * sin(centric), cos(centric)) * degree;
}

export function planetocentricLatitude(graphic: number) {
  return Math.atan2(sin(graphic), latitudeRatio * cos(graphic)) * degree;
}

export function solarFrame(utcMs: number) {
  const offset = terrestrialOffset(utcMs);
  if (offset === null) return null;
  const jd = 2440587.5 + (utcMs / 1000 + offset) / 86400;
  const days = jd - 2451545;
  const anomaly = 19.3871 + 0.52402073 * days;
  const fms = 270.3871 + 0.524038496 * days;
  const perturbation = perturbations.reduce((sum, [amplitude, period, phase]) =>
    sum + amplitude * cos(0.985626 * days / period + phase), 0);
  const centre = (10.691 + 3e-7 * days) * sin(anomaly) + 0.623 * sin(2 * anomaly) + 0.050 * sin(3 * anomaly)
    + 0.005 * sin(4 * anomaly) + 0.0005 * sin(5 * anomaly) + perturbation;
  const ls = wrap(fms + centre, 360);
  const eot = 2.861 * sin(2 * ls) - 0.071 * sin(4 * ls) + 0.002 * sin(6 * ls) - centre;
  const primeMean = wrap(24 * ((jd - 2451549.5) / meanSolDays + 44796 - 0.0009626), 24);
  const declination = Math.asin(0.42565 * sin(ls)) * degree + 0.25 * sin(ls);
  const subsolarLongitude = normalizeLon(180 - 15 * primeMean - eot);
  return { ls, eot, primeMean, declination, subsolarLongitude };
}

type SolarFrame = NonNullable<ReturnType<typeof solarFrame>>;
export function localSun(frame: SolarFrame, [lon, lat]: LonLat) {
  const meanTime = wrap(frame.primeMean + lon / 15, 24);
  const trueTime = wrap(meanTime + frame.eot / 15, 24);
  const latitude = planetographicLatitude(lat);
  const hourAngle = normalizeLon(frame.subsolarLongitude - lon);
  const v = sin(frame.declination) * sin(latitude) + cos(frame.declination) * cos(latitude) * cos(hourAngle);
  const elevation = Math.asin(Math.min(1, Math.max(-1, v))) * degree;
  const east = sin(hourAngle) * cos(frame.declination);
  const north = sin(frame.declination) * cos(latitude) - cos(frame.declination) * sin(latitude) * cos(hourAngle);
  const azimuth = Math.hypot(east, north) > 1e-12 ? wrap(Math.atan2(east, north) * degree, 360) : null;
  return { meanTime, trueTime, elevation, azimuth };
}

export function daylightWindow(frame: SolarFrame, latitude: number) {
  const phi = planetographicLatitude(latitude);
  const offset = sin(phi) * sin(frame.declination), swing = cos(phi) * cos(frame.declination);
  if (offset >= swing) return { status: "polar-day" as const, daylightMarsHours: 24 };
  if (offset <= -swing) return { status: "polar-night" as const, daylightMarsHours: 0 };
  const halfDay = Math.acos(-offset / swing) * degree / 15;
  return { status: "crossings" as const, sunriseLtst: 12 - halfDay, sunsetLtst: 12 + halfDay, daylightMarsHours: 2 * halfDay };
}

export function solarTerminator(frame: SolarFrame): LonLat[][] {
  const limit = 90 - Math.abs(frame.declination);
  return [-1, 1].map((side) => Array.from({ length: 181 }, (_, i): LonLat => {
    const latitude = limit * (i / 90 - 1);
    const cosine = -Math.tan(radians(latitude)) * Math.tan(radians(frame.declination));
    const direction = Math.acos(Math.min(1, Math.max(-1, cosine))) * degree;
    return [normalizeLon(frame.subsolarLongitude + side * direction), planetocentricLatitude(latitude)];
  }));
}

export function solarClock(hours: number) {
  const totalMinutes = wrap(Math.round(hours * 60), 1440);
  return String(Math.floor(totalMinutes / 60)).padStart(2, "0") + ":" + String(totalMinutes % 60).padStart(2, "0");
}
