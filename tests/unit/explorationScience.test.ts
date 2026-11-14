import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { decodeScienceGrid, explorationScience, sampleGeology, scienceCellIndex, scienceCellValue } from "../../lib/explorationScience";
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
