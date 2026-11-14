import { expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { calculateRoutes, type TerrainMeta } from '../../lib/routing';
import type { LonLat } from '../../lib/mars';
const meta:TerrainMeta=JSON.parse(readFileSync('public/processed/jezero.json','utf8'));
function float32(path:string){const b=readFileSync('public'+path);return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
it('computes and checks three actual Jezero terrain traverses',()=>{
  const terrain={meta,elevation:float32(meta.elevationUrl),slope:float32(meta.slopeUrl),valid:new Uint8Array(readFileSync('public'+meta.validUrl))};
  const cases=meta.examples.map((points,index)=>{
    const endpoints=points as LonLat[];
    const routes=calculateRoutes(terrain,{endpoints,maxSlope:20,riskWeight:4});
    expect(routes[0].distance).toBeLessThanOrEqual(routes[1].distance+1e-6);
    expect(routes[1].cost).toBeLessThanOrEqual(routes[0].distance+4*routes[0].riskIntegral+1e-6);
    for(const route of routes){
      expect(route.maxSlope).toBeLessThanOrEqual(20);
      expect(route.coordinates.length).toBeGreaterThan(2);
      expect(route.cells.every(i=>terrain.valid[i]===1&&Number.isFinite(terrain.elevation[i]))).toBe(true);
      expect(route.snapping.every(v=>v<15)).toBe(true);
      expect(route.profile.at(-1)!.distance).toBe(route.distance);
    }
    return {id:index+1,endpoints,maxSlope:20,riskWeight:4,routes:routes.map(({coordinates,profile,...route})=>({...route,coordinateCount:coordinates.length,profileCount:profile.length}))};
  });
  mkdirSync('data/validation',{recursive:true});
  writeFileSync('data/validation/routes.json',JSON.stringify({terrainSha256:meta.sha256,cases},null,2));
},60000);
