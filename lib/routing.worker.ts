import { calculateRoutes, type TerrainMeta, type RouteRequest } from './routing';
interface WorkerInput {meta:TerrainMeta;request:RouteRequest}
self.onmessage=async(event:MessageEvent<WorkerInput>)=>{
  try{
    const {meta,request}=event.data;
    const buffers=await Promise.all([meta.elevationUrl,meta.slopeUrl,meta.validUrl].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`Terrain download failed (${r.status}).`);return r.arrayBuffer();}));
    const terrain={meta,elevation:new Float32Array(buffers[0]),slope:new Float32Array(buffers[1]),valid:new Uint8Array(buffers[2])};
    if(terrain.elevation.length!==meta.width*meta.height||terrain.slope.length!==terrain.elevation.length||terrain.valid.length!==terrain.elevation.length)throw new Error('Terrain array dimensions do not match metadata.');
    self.postMessage({routes:calculateRoutes(terrain,request)});
  }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
