import { expect, it } from "vitest";
import { daylightWindow, localSun, planetocentricLatitude, solarClock, solarFrame, solarTerminator, terrestrialOffset } from "../../lib/marsSolar";
import { analyseDaylight } from "../../lib/missionEnvironment";
import { emptyMission, missionTiming } from "../../lib/missionPlan";
import { geographicRoute } from "../../lib/planner";
import { MARS_RADIUS, projectedToLonLat } from "../../lib/mars";
import { jezeroTerrain } from "../../lib/terrainRegistry";
import { testTerrainRay } from "../../lib/terrainVisibility";
import type { Terrain } from "../../lib/routing";

it("reproduces the two published NASA Mars24 worked examples", () => {
  const frame = solarFrame(Date.parse("2000-01-06T00:00:00Z"))!;
  const sun = localSun(frame, [0, 0]);
  expect(frame.ls).toBeCloseTo(277.18758, 4);
  expect(frame.eot).toBeCloseTo(-5.18774, 4);
  expect(sun.meanTime).toBeCloseTo(23.99425, 4);
  expect(sun.trueTime).toBeCloseTo(23.64840, 4);
  expect(Math.abs(sun.elevation - (90 - 154.26182))).toBeLessThan(0.001);
  expect(sun.azimuth).toBeCloseTo(191.03905, 4);
  const spirit = solarFrame(Date.parse("2004-01-03T13:46:31Z"))!;
  const point: [number, number] = [175.298, planetocentricLatitude(-14.640)];
  const position = localSun(spirit, point);
  expect(spirit.ls).toBeCloseTo(327.32416, 4);
  expect(position.meanTime).toBeCloseTo(0.85190, 4);
  expect(Math.abs(position.elevation - (90 - 151.93895))).toBeLessThan(0.001);
  expect(position.azimuth).toBeCloseTo(179.99383, 4);
  expect(Math.abs(position.trueTime - 0.00025) * 3600).toBeLessThan(0.5);
  expect(localSun(spirit, [point[0] - 360, point[1]]).trueTime).toBeCloseTo(position.trueTime, 8);
});

it("handles UTC leaps, polar day and darkness, and the geometric terminator", () => {
  expect(terrestrialOffset(Date.parse("2016-12-31T23:59:59Z"))).toBeCloseTo(68.184, 5);
  expect(terrestrialOffset(Date.parse("2017-01-01T00:00:00Z"))).toBeCloseTo(69.184, 5);
  expect(solarFrame(Date.parse("2027-01-01T00:00:00Z"))).toBeNull();
  const frame = solarFrame(Date.parse("2026-11-15T15:00:00Z"))!;
  expect(daylightWindow(frame, 89).status).toBe("polar-day");
  expect(daylightWindow(frame, -89).status).toBe("polar-night");
  expect(daylightWindow(frame, 0)).toMatchObject({ sunriseLtst: 6, sunsetLtst: 18, daylightMarsHours: 12 });
  expect(solarClock(23.999)).toBe("00:00");
  for (const point of solarTerminator(frame).flat()) expect(localSun(frame, point).elevation).toBeCloseTo(0, 5);
});

it("samples a timed journey with a real horizon crossing and dwell anchored to its waypoint", async () => {
  const route = geographicRoute({ start: [0, 0], end: [0.1, 0], waypoints: [[0.05, 0]] });
  const assumptions = { ...emptyMission, departure: "2026-11-15T18:00", speedKmh: 30, dwellMinutes: 10 };
  const result = await analyseDaylight(route, undefined, assumptions, () => false);
  const timeline = result.timeline!;
  expect(timeline.durationSeconds).toBeCloseTo(missionTiming(route, undefined, assumptions).elapsedSeconds!, 7);
  expect(timeline.crossings).toHaveLength(1);
  expect(timeline.daylightSeconds).toBeGreaterThan(0);
  expect(timeline.daylightSeconds).toBeLessThan(timeline.durationSeconds);
  expect(timeline.samples.filter(({ dwell }) => dwell).every(({ position }) => position[0] === 0.05)).toBe(true);
  expect(timeline.samples.filter(({ dwell }) => dwell).length).toBeGreaterThan(0);
  expect(Math.max(...timeline.samples.slice(1).map((sample, i) => sample.seconds - timeline.samples[i].seconds))).toBeLessThanOrEqual(60);
});

it("agrees with an analytical spherical chord and handles relief, heights and nodata", () => {
  const width = 401, height = 3;
  const terrain: Terrain = {
    meta: { ...jezeroTerrain, width, height, pixelSize: 20, transform: [20, 0, -10, 0, -20, 30] },
    elevation: new Float32Array(width * height), slope: new Float32Array(width * height), valid: new Uint8Array(width * height).fill(1),
  };
  const start = projectedToLonLat(0, 0), end = projectedToLonLat(8000, 0);
  const higher = testTerrainRay(terrain, start, 3, end, 3);
  expect(higher.status).toBe("clear");
  expect(higher.clearanceM).toBeCloseTo((MARS_RADIUS + 3) * Math.cos(4000 / MARS_RADIUS) - MARS_RADIUS, 4);
  expect(testTerrainRay(terrain, start, 0.5, end, 0.5).status).toBe("obstructed");
  for (let row = 0; row < height; row++) terrain.elevation[row * width + 200] = 12;
  expect(testTerrainRay(terrain, start, 3, end, 3).status).toBe("obstructed");
  terrain.valid[width + 200] = 0;
  expect(testTerrainRay(terrain, start, 3, end, 3).status).toBe("unknown");
  expect(testTerrainRay(terrain, start, 3, projectedToLonLat(8050, 0), 3).status).toBe("unknown");
});
