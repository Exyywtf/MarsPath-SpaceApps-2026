import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { analyseRoute, sampleClimate, sphericalIntervals, type CellBounds, type RouteAnalysis } from "../../lib/routeAnalysis";
import { marsDistance, type LonLat } from "../../lib/mars";
import { defaultSettings, geographicRoute, type PlannedRoute } from "../../lib/planner";
import { effectiveDoseAtPressure, historicalCoverage, radiationManifest, radiationPressure, sampleRadiation } from "../../lib/radiation";
import { rankCandidates } from "../../lib/routeRanking";
import fixture from "../../data/validation/v3-radiation.json";
import climate from "../../public/processed/mcd-v62.json";

const data = readFileSync("public"+radiationManifest.pressureUrl);
const pressure = new Float32Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));

it("matches the pressure source anchors, surface table, seam, and coverage masks", () => {
  expect(createHash("sha256").update(data).digest("hex")).toBe(radiationManifest.pressureSha256);
  for (const anchor of fixture.pressureAnchors)
    expect(radiationPressure(pressure,[anchor.lon,anchor.lat])).toBeCloseTo(anchor.gridPa,5);
  expect(effectiveDoseAtPressure(753)).toBeCloseTo(167.5192167,4);
  expect(effectiveDoseAtPressure(81)).toBeNull();
  expect(sampleRadiation(pressure,[59,-48])).toBeNull();
  expect(sampleRadiation(pressure,[180,0])).toBeCloseTo(167.716353,5);
  expect(sampleRadiation(pressure,[180,0])).toBe(sampleRadiation(pressure,[-180,0]));
  expect(sampleRadiation(pressure,[45,90])).toBeNull();
  expect(historicalCoverage([70,-43])).toBe(true);
  expect(historicalCoverage([5,10])).toBe(false);
  expect(sampleClimate(climate,"wind",[0,90])).toBeNull();
});

it("cuts oblique arcs on both sides of the date line, splits at the pole, and conserves length", () => {
  for (const [a,b] of [
    [[178.12,17.63],[-177.81,21.11]], [[0,88.9],[180,88.8]], [[-2,4],[1,3]],
  ] as [LonLat,LonLat][]) {
    const spans = sphericalIntervals(a,b);
    const reverse = sphericalIntervals(b,a).reverse();
    expect(spans.length).toBeGreaterThan(2);
    expect(spans).toHaveLength(reverse.length);
    expect(spans.reduce((d,sample) => d+sample.length,0)).toBeCloseTo(marsDistance(a,b),5);
    for (const [i,sample] of spans.entries()) {
      expect(sample.length).toBeLessThanOrEqual(25000);
      expect(sample.length).toBeCloseTo(reverse[i].length,4);
      expect(sample.point[1]).toBeCloseTo(reverse[i].point[1],7);
    }
  }
  const intervals = sphericalIntervals([179.75,0],[-179.65,0]);
  expect(intervals).toHaveLength(2);
  expect(intervals[0].length).toBeCloseTo(marsDistance([179.75,0],[180,0]),5);
});

it("reports ordered connectors twice at intermediate stops and keeps the exact spherical length", async () => {
  const coordinates: LonLat[] = [[77.42,18.46],[77.43,18.46],[77.44,18.47]];
  const stops: LonLat[] = [[77.4201,18.46],[77.43,18.462],[77.441,18.47]];
  const route: PlannedRoute = {
    id:"test", name:"test", tier:"regional", coordinates, stops, stopIndices:[0,1,2],
    connectors: stops.map((p,i) => [p,coordinates[i]]), reached: [], snapping:[],
    distance:0, assessedDistance:0,
  };
  const result = await analyseRoute(route,climate,pressure);
  expect(result.samples.map(({role}) => role)).toEqual(["connector","terrain","connector","connector","terrain","connector"]);
  const expected = marsDistance(stops[0],coordinates[0])+marsDistance(coordinates[0],coordinates[1])+
    2*marsDistance(stops[1],coordinates[1])+marsDistance(coordinates[1],coordinates[2])+marsDistance(coordinates[2],stops[2]);
  expect(result.distance).toBeCloseTo(expected,5);
  expect(result.factors.radiation.coverage).toBe(1);
  // Independent Python midpoint quadrature on these six arcs.
  expect(result.factors.radiation.mean).toBeCloseTo(167.922419438,6);
  expect(result.factors.temperature.mean).toBeCloseTo(202.926478670,6);
});

it("ranks fully separated climate cells and renormalizes unresolved or incomplete evidence", async () => {
  const connection = geographicRoute({ start:[0,0], end:[1,1], waypoints:[] });
  const paths: PlannedRoute[] = [{ ...connection, id:"one", tier:"coarse" }, { ...connection, id:"two", tier:"coarse" }];
  const template = await analyseRoute(connection,climate,pressure);
  const example = (cell: number): RouteAnalysis => ({
    ...template,
    samples: [{...template.samples[0],role:"terrain", climateCell:cell,length:100}],
  });
  const grid: CellBounds = { temperature:new Map([[1,[160,165]],[2,[195,205]],[3,[182,192]]]), pressure:new Map(), wind:new Map() };
  const preferences = {enabled:true,weight:20,bands:{temperature:{min:190,max:210}}};
  const separated = rankCandidates(paths,defaultSettings,preferences,{one:example(1),two:example(2)},grid);
  expect(separated.ranking.weights.climate).toBe(.2);
  expect(separated.scores).toEqual([.2,0]);
  const overlap = rankCandidates(paths,defaultSettings,preferences,{one:example(1),two:example(3)},grid);
  expect(overlap.ranking.weights.climate).toBe(0);
  expect(overlap.ranking.weights.distance).toBe(1);
  const sameCell = rankCandidates(paths,defaultSettings,preferences,{one:example(2),two:example(2)},grid);
  expect(sameCell.ranking.climate.temperature?.reason).toContain("cannot distinguish");
  const missing = rankCandidates(paths,defaultSettings,preferences,{one:example(2)},grid);
  expect(missing.ranking.climate.temperature?.reason).toContain("incomplete");
});
