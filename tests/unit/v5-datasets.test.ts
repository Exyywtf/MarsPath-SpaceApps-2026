import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { calculateMission, calculateReturn, LegCache } from "../../lib/mission";
import { coordinateCell, cellCoordinate, type Terrain, type TerrainMeta } from "../../lib/routing";
import { defaultSettings, type PlannerRequest } from "../../lib/planner";
import { oxiaTerrain, regionalTerrains, molaTerrain } from "../../lib/terrainRegistry";
import meda from "../../public/processed/meda-sols-30-32-v1.json";
import medaManifest from "../../data/meda-observations.json";
import oxiaManifest from "../../public/processed/oxia.json";
import independent from "../../data/validation/v5-oxia.json";
import coverage from "../../data/terrain-coverage.json";
import { medaMeanHours, medaProfileSegments } from "../../lib/medaObservations";

const bytes = (url: string) => readFileSync("public" + url);
const checksum = (url: string) => createHash("sha256").update(bytes(url)).digest("hex");

it("preserves native Oxia registration, checksums and the shared 64 MiB terrain limit", () => {
  expect(oxiaTerrain.pixelSize).toBeCloseTo(20.2341182386, 9);
  for (const [i, example] of oxiaTerrain.examples[0].entries()) {
    const cell = coordinateCell(oxiaTerrain, [example[0], example[1]]);
    expect(cell).toBe([741 * 1483 + 667, 771 * 1483 + 785][i]);
    const roundTrip = cellCoordinate(oxiaTerrain, cell);
    expect(roundTrip[0]).toBeCloseTo(example[0], 10);
    expect(roundTrip[1]).toBeCloseTo(example[1], 10);
    expect(coordinateCell(oxiaTerrain, [example[0] + 360, example[1]])).toBe(cell);
  }
  expect(checksum(oxiaTerrain.elevationUrl)).toBe(oxiaManifest.arrayChecksums.elevation);
  expect(checksum(oxiaTerrain.slopeUrl)).toBe(oxiaManifest.arrayChecksums.slope);
  expect(checksum(oxiaTerrain.validUrl)).toBe(oxiaManifest.arrayChecksums.valid);
  expect(coverage.regions.find(({ id }) => id === oxiaTerrain.id)?.maskSha256).toBe(oxiaManifest.arrayChecksums.valid);
  expect([molaTerrain, ...regionalTerrains].reduce((sum, meta) => sum + meta.width * meta.height * 9, 0)).toBeLessThan(64 * 1024 * 1024);
});

it("reproduces independently checked Oxia outbound and return routes", async () => {
  const load = async (meta: TerrainMeta): Promise<Terrain> => {
    const array = (url: string) => {
      const file = bytes(url);
      return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    };
    return { meta, elevation: new Float32Array(array(meta.elevationUrl)), slope: new Float32Array(array(meta.slopeUrl)), valid: new Uint8Array(array(meta.validUrl)) };
  };
  const { start, end } = independent.draft;
  const request: PlannerRequest = { id: 1, draft: { start: [start[0], start[1]], end: [end[0], end[1]], waypoints: [] }, settings: { ...defaultSettings, objectives: [] } };
  const result = await calculateMission(request, load, () => false);
  expect(result.meta?.id).toBe(oxiaTerrain.id);
  for (const reference of independent.outbound) {
    const route = result.routes.find(({ id }) => id === reference.id)!;
    expect(route.distance).toBeCloseTo(reference.distanceM, 4);
    expect(route.terrain?.ascent).toBeCloseTo(reference.ascentM, 6);
    expect(route.terrain?.maxSlope).toBeCloseTo(reference.maximumSlopeDegrees, 6);
    expect(route.reachedTargets).toHaveLength(0);
  }
  const back = await calculateReturn(request, false, load, () => false, new LegCache());
  expect(back.status).toBe("ready");
  if (back.status !== "ready") throw new Error(back.reason);
  expect(back.route.stops).toEqual([request.draft.end, request.draft.start]);
  expect(back.route.terrain?.ascent).toBeCloseTo(independent.return.ascentM, 6);
  expect(back.route.terrain?.descent).toBeCloseTo(independent.return.descentM, 6);
  expect(back.route.distance).toBeCloseTo(independent.return.distanceM, 4);
});

it("keeps MEDA product identities, true gaps, missing channels and zero route weight", () => {
  expect(checksum(medaManifest.url)).toBe(medaManifest.sha256);
  expect(meda.rankingWeight).toBe(0);
  expect(meda.products).toHaveLength(9);
  expect(meda.series.map(({ sol }) => sol)).toEqual([30, 31, 32]);
  const start = meda.series[0].samples[0];
  expect(start).toMatchObject({ utc: "2021-03-21T00:11:53.795Z", lmst: "00030M00:00:00.651", pressurePa: 742.11, sourceRow: 2 });
  expect(start.temperatureK).toEqual([206.42, 207.74, 207.12, 209.77, 208.05]);
  expect(start.positionM).toEqual([31.8, -52.56, 1.51]);
  expect(meda.series.flatMap(({ samples }) => samples).filter(({ temperatureK }) => temperatureK.every((v) => v === null))).toHaveLength(33);
  for (const series of meda.series) {
    for (const channel of [0, 1, 5]) {
      const gaps = channel ? series.temperatureGaps : series.gaps;
      for (const segment of medaProfileSegments(series, channel)) {
        expect(segment.every(({ value }) => Number.isFinite(value))).toBe(true);
        for (const gap of gaps) {
          const before = series.samples.find(({ sclk }) => sclk === gap.startSclk);
          const after = series.samples.find(({ sclk }) => sclk === gap.stopSclk);
          if (before && after) expect(segment.some(({ hours }) => hours <= medaMeanHours(before.lmst)) &&
            segment.some(({ hours }) => hours >= medaMeanHours(after.lmst))).toBe(false);
        }
      }
    }
  }
});
