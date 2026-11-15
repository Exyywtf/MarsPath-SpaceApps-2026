import type { LonLat } from "./mars";
import type { PlannedRoute } from "./planner";
import type { TerrainMeta } from "./routing";

export const missionObjectives = [
  ["", "Choose a research objective"],
  ["ancient-water", "Investigate ancient water"],
  ["sedimentary", "Explore sedimentary geology"],
  ["clay", "Study clay minerals"],
  ["carbonate", "Investigate carbonates"],
  ["ice", "Investigate subsurface ice evidence"],
  ["volcanic", "Study volcanic formations"],
  ["destination", "Explore a destination"],
  ["custom", "Custom research objective"],
] as const;

export type MissionObjective = typeof missionObjectives[number][0];
export type ReturnMode = "terrain" | "geographic" | null;
export type MissionAssumptions = {
  name: string;
  objective: MissionObjective;
  customObjective: string;
  speedKmh: number | null;
  dwellMinutes: number | null;
  departure: string;
  returnMode: ReturnMode;
  station: LonLat | null;
  stationHeightM: number | null;
  observerHeightM: number | null;
};

export const emptyMission: MissionAssumptions = {
  name: "", objective: "", customObjective: "", speedKmh: null, dwellMinutes: null,
  departure: "", returnMode: null, station: null, stationHeightM: null, observerHeightM: null,
};

export const jezeroMissionExample: MissionAssumptions = {
  ...emptyMission, name: "Jezero delta investigation", objective: "ancient-water",
  speedKmh: 2, dwellMinutes: 10, departure: "2026-11-15T15:00", returnMode: "terrain",
};

export type MissionReturn =
  | { status: "ready"; route: PlannedRoute; terrain?: TerrainMeta; reason: string }
  | { status: "unavailable"; reason: string };

export function missionTiming(outbound: PlannedRoute, inbound: PlannedRoute | undefined, mission: MissionAssumptions) {
  const stopCount = Math.max(0, (outbound.stops?.length ?? 2) - 2);
  const dwellSeconds = stopCount * (mission.dwellMinutes ?? 0) * 60;
  const distanceM = outbound.distance + (inbound?.distance ?? 0);
  const speed = mission.speedKmh;
  if (speed === null || !Number.isFinite(speed) || speed <= 0 ||
      (mission.dwellMinutes !== null && (!Number.isFinite(mission.dwellMinutes) || mission.dwellMinutes < 0))) {
    return { distanceM, stopCount };
  }
  const travelSeconds = distanceM * 3.6 / speed;
  if (!Number.isFinite(travelSeconds + dwellSeconds)) return { distanceM, stopCount };
  return { distanceM, stopCount, dwellSeconds, travelSeconds, elapsedSeconds: travelSeconds + dwellSeconds };
}
