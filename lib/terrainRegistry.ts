import jezero from "../public/processed/jezero.json";
import mola from "../public/processed/mola-quarter.json";
import oxia from "../public/processed/oxia.json";
import type { TerrainMeta } from "./routing";

export const jezeroTerrain: TerrainMeta = jezero;
export const molaTerrain: TerrainMeta = mola;
export const oxiaTerrain: TerrainMeta = oxia;
export const regionalTerrains: readonly TerrainMeta[] = [jezeroTerrain, oxiaTerrain];
