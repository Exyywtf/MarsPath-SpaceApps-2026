import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { decodeScienceGrid, explorationScience, sampleGeology, scienceCellIndex, scienceCellValue, type MineralObservation } from "../../lib/explorationScience";
import validation from "../../data/validation/v4-datasets.json";

it("decodes grid runs, rejects malformed input and keeps missing cells distinct", () => {
  const bytes = new Uint8Array([2, 0, 17, 0, 1, 0, 0, 0, 1, 0, 30, 0]);
  const grid = decodeScienceGrid(bytes.buffer, 2, 2);
  expect(scienceCellValue(grid, [-165, 45])).toBe(17);
  expect(scienceCellValue(grid, [0, -30])).toBe(30);
  expect(scienceCellValue(grid, [180, -30])).toBeNull();
  expect(scienceCellValue(grid, [0, -90.0001])).toBeNull();
  expect(scienceCellIndex(2, 2, [-180, -90])).toBe(2);
  expect(() => decodeScienceGrid(bytes.buffer, 2, 3)).toThrow("truncated");
  expect(() => decodeScienceGrid(bytes.buffer, 1, 2)).toThrow("run");
});

it("preserves the PDS hydrated sites, east-positive registration and source row identity", () => {
  const { data, count, sourceRows, exactDuplicateRows, instrumentCounts } = explorationScience.hydrated;
  const bytes = readFileSync(`public${data.url}`);
  expect(bytes.length).toBe(data.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(data.sha256);
  const sites: Extract<MineralObservation, { kind: "hydrated" }>[] = JSON.parse(bytes.toString());
  expect(sites).toHaveLength(count);
  expect(new Set(sites.map((site) => site.id)).size).toBe(1851);
  expect(sites.flatMap((site) => site.sourceRows).sort((a, b) => a - b)).toEqual(
    Array.from({ length: sourceRows }, (_, i) => i + 1));
  expect(sourceRows - count).toBe(exactDuplicateRows);
  expect(sites.filter((site) => site.omegaProduct && site.crismProduct)).toHaveLength(instrumentCounts.both);
  expect(sites.find((site) => site.id === "row-635")).toMatchObject({
    point: [-18.2, 22.48], crismProduct: "FRT00003BFB",
  });
  expect(sites.find((site) => site.id === "row-20")).toMatchObject({
    point: [-178, -29.2], omegaProduct: "ORB4436_2_DATA", crismProduct: "FRT00013039",
  });
  expect(sites.find((site) => site.id === "row-1492")).toMatchObject({
    point: [82.8, -32.8], sourceRows: [1492, 1493], omegaProduct: "ORB2206_4_DATA",
  });
});

it("matches the packaged geology, observation and thermal assets and uses source polygon IDs", () => {
  const { geology, minerals, thermal } = explorationScience;
  for (const asset of [geology.data, geology.image, geology.catalog, minerals.data, thermal.data, thermal.image]) {
    const bytes = readFileSync(`public${asset.url}`);
    expect(bytes.length).toBe(asset.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
  }
  const bytes = Uint8Array.from(gunzipSync(readFileSync(`public${geology.data.url}`)));
  const grid = decodeScienceGrid(bytes.buffer, geology.width, geology.height);
  const catalog = JSON.parse(readFileSync(`public${geology.catalog.url}`, "utf8"));
  expect(Object.keys(catalog)).toHaveLength(1311);
  expect(geology.units).toHaveLength(44);
  for (const anchor of validation.geology.anchors) {
    expect(sampleGeology({ ...grid, catalog }, [anchor.lon, anchor.lat])).toMatchObject({ code: anchor.unit, featureId: anchor.featureId });
  }
  expect(sampleGeology({ ...grid, catalog }, [180, 0])).toEqual(sampleGeology({ ...grid, catalog }, [-180, 0]));
  const observations = JSON.parse(readFileSync(`public${minerals.data.url}`, "utf8"));
  expect(observations).toHaveLength(777);
  expect(observations.find((point: { kind: string; id: string }) => point.kind === "chloride" && point.id === "0").point).toEqual([-138.707, -38.781]);
  expect(thermal.coverage).toBeLessThan(thermal.nativeCoverage);
});
