import records from "../data/science-targets.json";
import type { LonLat } from "./mars";
export interface ScienceTarget {
  id: string;
  name: string;
  unit: string;
  coordinates: LonLat;
  objectives: string[];
  interpretation: string;
  positionNote: string;
  sourceUrl: string;
  citation: string;
  coordinateNote: string;
}
export const scienceTargets = records as ScienceTarget[];
export const localObjectives = [
  { id: "ancient-water", name: "Ancient water" },
  { id: "sedimentary", name: "Sedimentary geology" },
];
