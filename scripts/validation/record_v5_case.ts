import { readFile } from "node:fs/promises";
import { calculateMission, calculateReturn, LegCache } from "../../lib/mission";
import { defaultSettings, type PlannerRequest } from "../../lib/planner";
import { rankAcceptedCandidates, chooseCandidates } from "../../lib/routeRanking";
import { defaultClimatePreferences } from "../../lib/routeAnalysis";
import { type TerrainMeta } from "../../lib/routing";
import { jezeroTerrain, regionalTerrains } from "../../lib/terrainRegistry";
import { jezeroMissionExample, missionTiming } from "../../lib/missionPlan";

const requestedId = process.argv[2] || jezeroTerrain.id;
const terrain = regionalTerrains.find(({ id }) => id === requestedId);
if (!terrain) throw new Error("Unregistered validation dataset: " + requestedId);
const [start, end] = terrain.examples[0];
const request: PlannerRequest = {
  id: 1, draft: { start: [start[0], start[1]], end: [end[0], end[1]], waypoints: [] },
  settings: { ...defaultSettings, objectives: terrain.id === jezeroTerrain.id ? ["ancient-water"] : [] },
};

const load = async (meta: TerrainMeta) => {
  const [elevation, slope, valid] = await Promise.all(
    [meta.elevationUrl, meta.slopeUrl, meta.validUrl].map(async (url) => Uint8Array.from(await readFile("public" + url)).buffer),
  );
  return { meta, elevation: new Float32Array(elevation), slope: new Float32Array(slope), valid: new Uint8Array(valid) };
};
const cache = new LegCache();
const base = await calculateMission(request, load, () => false, cache);
if (base.meta?.id !== terrain.id) throw new Error("Example failed to select the requested regional grid.");
const accepted = chooseCandidates(base, base.pool ?? base.routes, request.settings);
const inbound = await calculateReturn(request, false, load, () => false, cache);
if (inbound.status !== "ready" || !inbound.terrain || inbound.terrain.id !== terrain.id)
  throw new Error("Expected terrain on the return.");
const score = (weights: [number, number, number]) =>
  rankAcceptedCandidates(accepted.routes, {
    ...request.settings, distanceWeight: weights[0], terrainWeight: weights[1], scienceWeight: weights[2],
  }, defaultClimatePreferences).scores;
process.stdout.write(JSON.stringify({
  request, terrain, routes: accepted.routes, inbound: inbound.route,
  scenarios: [{ weights: [35, 45, 20], scores: score([35, 45, 20]) },
    { weights: [100, 0, 0], scores: score([100, 0, 0]) },
    { weights: [0, 0, 100], scores: score([0, 0, 100]) }],
  mission: jezeroMissionExample, timing: missionTiming(accepted.routes[0], inbound.route, jezeroMissionExample),
}));
