import { daylightWindow, localSun, solarFrame, solarProvenance, solarTerminator, utcFromInput } from "./marsSolar";
import { marsDistance, type LonLat } from "./mars";
import { orderedSpans, sphericalArc, type SpanRole } from "./routeAnalysis";
import { missionTiming, type MissionParameters } from "./missionPlan";
import type { PlannedRoute } from "./planner";

const maxTimelineSeconds = 7 * 86400;
type Sample = { seconds: number; position: LonLat; elevation: number; role: SpanRole; phase: "outbound" | "return"; dwell?: true };
type SampledTrip = { samples: Sample[]; daylightSeconds: number; durationSeconds: number; crossings: number[] };
export type MissionDaylight = {
  provenance: typeof solarProvenance;
  reason?: string;
  timeline?: SampledTrip;
  alternateDepartures?: { offsetHours: number; departureUtc: string; daylightSeconds: number }[];
  samplingSeconds?: number;
} & ({
  departureUtc: string; ls: number; start: ReturnType<typeof localSun>;
  window: ReturnType<typeof daylightWindow>; terminator: LonLat[][];
} | {
  departureUtc?: never; ls?: never; start?: never; window?: never; terminator?: never;
});

function schedule(outbound: PlannedRoute, inbound: PlannedRoute | undefined, speed: number, dwellSeconds: number) {
  let end = 0;
  return [outbound, ...(inbound ? [inbound] : [])].flatMap((route, index) => [...orderedSpans(route, index === 0)].flatMap((span) => {
    const duration = span.dwell ? dwellSeconds : marsDistance(span.a, span.b) * 3.6 / speed;
    if (duration <= 1e-8) return [];
    const from = end;
    end += duration;
    const phase = index === 0 ? "outbound" as const : "return" as const;
    return [{ ...span, phase, from, end, arc: sphericalArc(span.a, span.b) }];
  }));
}

async function daylightTrip(utc: number, itinerary: ReturnType<typeof schedule>, cancelled: () => boolean, retain: boolean) {
  const samples: Sample[] = [];
  const durationSeconds = itinerary.at(-1)?.end ?? 0;
  const count = Math.max(1, Math.ceil(durationSeconds / 60));
  if (!itinerary.length || durationSeconds > maxTimelineSeconds || !solarFrame(utc + durationSeconds * 1000)) return;
  let current = 0, previous: Sample | undefined, daylightSeconds = 0;
  const crossings: number[] = [];
  const sample = (seconds: number) => {
    let a = 0, b = current;
    while (a < b) {
      const mid = (a + b) >>> 1;
      if (itinerary[mid].end < seconds) a = mid + 1;
      else b = mid;
    }
    const span = itinerary[a], frame = solarFrame(utc + seconds * 1000)!;
    const time = (seconds - span.from) / (span.end - span.from);
    const position = span.arc?.lonLat(span.arc.theta * time) ?? span.a;
    return { seconds, position, elevation: localSun(frame, position).elevation, role: span.role, phase: span.phase, dwell: span.dwell };
  };
  for (let i = 0; i <= count; i++) {
    const seconds = i / count * durationSeconds;
    while (current < itinerary.length - 1 && itinerary[current].end < seconds) current++;
    const next = sample(seconds);
    if (retain) samples.push(next);
    if (previous) {
      const bright = previous.elevation > 0, nextBright = next.elevation > 0;
      if (bright === nextBright) {
        if (bright) daylightSeconds += seconds - previous.seconds;
      } else {
        let lo = previous.seconds, hi = seconds;
        while (hi - lo > 1) {
          const mid = (lo + hi) / 2;
          if ((sample(mid).elevation > 0) === bright) lo = mid;
          else hi = mid;
        }
        const crossing = (lo + hi) / 2;
        crossings.push(crossing);
        daylightSeconds += bright ? crossing - previous.seconds : seconds - crossing;
      }
    }
    previous = next;
    if (i % 512 === 511) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelled()) throw new Error("Daylight calculation was superseded.");
    }
  }
  return { samples, daylightSeconds, durationSeconds, crossings } satisfies SampledTrip;
}

export async function analyseDaylight(
  route: PlannedRoute, inbound: PlannedRoute | undefined, mission: MissionParameters, cancelled: () => boolean,
): Promise<MissionDaylight> {
  const provenance = solarProvenance;
  const utc = utcFromInput(mission.departure), frame = utc === null ? null : solarFrame(utc);
  if (utc === null || !frame) return { provenance, reason: mission.departure ? "Departure is outside the supported 1972–2026 UTC range." : "Set an Earth UTC departure." };
  const point = route.stops?.[0] ?? route.coordinates[0];
  const base = {
    provenance, departureUtc: new Date(utc).toISOString(), ls: frame.ls,
    start: localSun(frame, point), window: daylightWindow(frame, point[1]), terminator: solarTerminator(frame),
  };
  const timing = missionTiming(route, inbound, mission);
  if (timing.elapsedSeconds === undefined || !mission.speedKmh)
    return { ...base, reason: "Enter a positive speed and a valid dwell time for a journey timeline." };
  if (mission.returnMode && !inbound) return { ...base, reason: "The round-trip timeline awaits the return leg." };
  const itinerary = schedule(route, inbound, mission.speedKmh, (mission.dwellMinutes ?? 0) * 60);
  const timeline = await daylightTrip(utc, itinerary, cancelled, true);
  if (!timeline) return { ...base, reason: "The timeline requires a nonzero journey of at most seven Earth days within the supported UTC dates." };
  const alternateDepartures = [];
  for (const offsetHours of [-1, 1]) {
    const departure = utc + offsetHours * 3600000;
    if (!solarFrame(departure)) continue;
    const alternate = await daylightTrip(departure, itinerary, cancelled, false);
    if (alternate) alternateDepartures.push({ offsetHours, departureUtc: new Date(departure).toISOString(), daylightSeconds: alternate.daylightSeconds });
  }
  return { ...base, timeline, alternateDepartures, samplingSeconds: 60 };
}
