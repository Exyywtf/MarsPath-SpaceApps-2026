import records from '@/data/locations.json';
import type { LonLat } from './mars';
export interface Location {
  id: string; name: string; coordinates: number[]; coordinateSource: string; coordinateNote: string;
  category: string; summary: string; tags: string[]; mission: string; sourceUrl: string;
  image: string | null; imageSource: string | null; imageCaption?: string; imageCredit?: string;
  sourceStatus: string; accessed: string;
}
export const locations: Location[] = records;
export const asLonLat = (p: number[]): LonLat => [p[0], p[1]];
export const globalSources = [
  {id:'trek',title:'NASA Mars Trek WMTS imagery',institution:'NASA / JPL / USGS',type:'Orbital imagery',url:'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars',description:'Viking global color mosaic; MOLA hillshade; regional CTX and HiRISE mosaics. Native resolutions and coverage vary. Tiles are visualization, not numerical terrain.'},
  {id:'mola',title:'MGS MOLA global DEM, 463 m',institution:'NASA / USGS',type:'Numerical terrain',url:'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m',description:'Supplied 46,080 × 23,040 int16 raster, Mars equirectangular sphere R=3,396,190 m, nodata −32768. Broad terrain context only; elevation referenced to the Martian areoid.'},
  {id:'ctx-dtm',title:'Mars 2020 TRN CTX DTM mosaic, 20 m',institution:'NASA / USGS',type:'Numerical terrain',url:'https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0',description:'Regional numerical terrain at 20 m projected spacing. Research-grade route analysis; does not resolve rocks or prove astronaut traversability.'},
  {id:'gazetteer',title:'Gazetteer of Planetary Nomenclature',institution:'IAU / USGS',type:'Coordinates',url:'https://planetarynames.wr.usgs.gov/SearchResults?Target=20_Mars',description:'Planetocentric, east-positive feature centres. Centres represent broad geographical features; they are not rover landing coordinates or precise sampling targets.'},
  {id:'mcd',title:'Mars Climate Database v6.2',institution:'LMD / collaborating institutions',type:'Modelled climate',url:'https://www-mars.lmd.jussieu.fr/mars/access',description:'Supplied screenshot-derived images report Ls=21.3°, 10 m above local surface, local time 0 h and climatological-average solar conditions. Geographic registration remains unverified. No local climate values or route penalties are inferred.'},
];
