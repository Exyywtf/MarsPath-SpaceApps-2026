import { readFileSync, writeFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { calculateMission,LegCache } from '../../lib/mission';
import { defaultSettings, type PlannerRequest } from '../../lib/planner';
import { type TerrainMeta,type Terrain } from '../../lib/routing';
import regional from '../../public/processed/jezero.json';
const terrains=new Map<string,Terrain>();
const load=async(meta:TerrainMeta)=>{if(terrains.has(meta.id))return terrains.get(meta.id)!;const array=(url:string)=>{const b=readFileSync('public'+url);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};const terrain={meta,elevation:new Float32Array(array(meta.elevationUrl)),slope:new Float32Array(array(meta.slopeUrl)),valid:new Uint8Array(array(meta.validUrl))};terrains.set(meta.id,terrain);return terrain;};
it('calculates real periodic global terrain and verified science alternatives',async()=>{
  const requests:PlannerRequest[]=[
    {id:1,draft:{start:[179,0],end:[-179,0],waypoints:[]},settings:{...defaultSettings}},
    {id:2,draft:{start:[130,-4],end:[131,-4],waypoints:[]},settings:{...defaultSettings}},
    {id:3,draft:{start:regional.examples[0][0] as [number,number],end:regional.examples[0][1] as [number,number],waypoints:[]},settings:{...defaultSettings,objectives:['ancient-water'],distanceWeight:0,terrainWeight:0,scienceWeight:100}},
    {id:4,draft:{start:[137.42,-4.49],end:[77.69,18.41],waypoints:[]},settings:{...defaultSettings}},
  ];
  const cases=[];
  for(const request of requests){
    const result=await calculateMission(request,load,()=>false);
    expect(result.routes).toHaveLength(3);expect(result.tier).toBe(request.id===3?'regional':'coarse');
    for(const route of result.routes){
      expect(route.terrain!.maxSlope).toBeLessThanOrEqual(20+1e-6);
      expect(route.distance).toBeGreaterThan(0);expect(route.assessedDistance).toBeGreaterThan(0);expect(route.quality!.validPathCells).toBe(route.quality!.pathCells);
      expect(route.coordinates.flat().every(Number.isFinite)).toBe(true);
      expect(route.distance).toBeGreaterThanOrEqual(route.assessedDistance);
    }
    if(request.id===1)expect(result.routes[0].assessedDistance).toBeLessThan(130000);
    if(request.id===3){expect(result.routes[2].reached).toContain('ancient-water');expect(result.routes[2].scienceStops).toHaveLength(1);expect(result.scienceAttempts).toBeGreaterThan(0);}
    cases.push({request,tier:result.tier,metaId:result.meta!.id,evaluatedCandidates:result.evaluatedCandidates,routes:result.routes.map(r=>({id:r.id,lambda:r.terrain!.lambda,stops:r.stops,cells:r.terrain!.cells,cost:r.terrain!.cost,distance:r.terrain!.distance,ascent:r.terrain!.ascent,descent:r.terrain!.descent,maxSlope:r.terrain!.maxSlope,reached:r.reached,scienceStops:r.scienceStops}))});
  }
  if(process.env.UPDATE_VALIDATION==='1')writeFileSync('data/validation/v2-routes.json',JSON.stringify({cases},null,2));
},90000);
it('caches completed terrain legs and rejects cancelled searches',async()=>{
  const request:PlannerRequest={id:1,draft:{start:regional.examples[0][0] as [number,number],end:regional.examples[0][1] as [number,number],waypoints:[]},settings:{...defaultSettings}},cache=new LegCache();
  await calculateMission(request,load,()=>false,cache);const warm=await calculateMission(request,load,()=>false,cache);
  expect(warm.cacheHits).toBeGreaterThanOrEqual(3);
  await expect(calculateMission(request,load,()=>true)).rejects.toThrow('Cancelled');
});
