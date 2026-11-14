import metadata from '../public/processed/jezero.json';
import { coordinateCell, cellCoordinate, findPathAsync, measurePath, type Terrain, type TerrainMeta, type RouteResult } from './routing';
import { draftPoints, geographicRoute, within, type PlannerRequest, type PlannerResult, type PlannedRoute } from './planner';
import { marsDistance } from './mars';
const cache=new Map<string,Promise<Terrain>>();let cacheBytes=0,latest=0;
async function load(meta:TerrainMeta){
  const existing=cache.get(meta.sha256);if(existing){cache.delete(meta.sha256);cache.set(meta.sha256,existing);return existing;}
  const bytes=meta.width*meta.height*9;
  while(cacheBytes+bytes>64*1024*1024&&cache.size){const key=cache.keys().next().value!;const old=await cache.get(key)!;cacheBytes-=old.elevation.byteLength+old.slope.byteLength+old.valid.byteLength;cache.delete(key);}
  const pending=Promise.all([meta.elevationUrl,meta.slopeUrl,meta.validUrl].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`Terrain download failed (${r.status}).`);return r.arrayBuffer();})).then(buffers=>{
    const terrain={meta,elevation:new Float32Array(buffers[0]),slope:new Float32Array(buffers[1]),valid:new Uint8Array(buffers[2])};
    if(terrain.elevation.length!==meta.width*meta.height||terrain.slope.length!==terrain.elevation.length||terrain.valid.length!==terrain.elevation.length)throw new Error('Terrain dimensions do not match metadata.');return terrain;
  });cache.set(meta.sha256,pending);cacheBytes+=bytes;
  try{return await pending;}catch(error){cache.delete(meta.sha256);cacheBytes-=bytes;throw error;}
}
self.onmessage=async(event:MessageEvent<PlannerRequest|{id:number;cancel:true}>)=>{
  const input=event.data;latest=input.id;if('cancel' in input)return;
  const started=performance.now(),cancelled=()=>latest!==input.id;
  try{
    const points=draftPoints(input.draft);if(points.length<2)throw new Error('Choose a start and destination.');
    const meta:TerrainMeta=metadata;
    if(input.settings.geographicOnly||!points.every(p=>within(meta,p))){
      const result:PlannerResult={routes:[geographicRoute(input.draft)],tier:'geographic',reason:input.settings.geographicOnly?'Geographic planning selected.':'Outside the supported regional DEM. Distance only; terrain is unassessed.',elapsedMs:performance.now()-started,cacheHits:0,warnings:[]};if(!cancelled())self.postMessage({id:input.id,result});return;
    }
    const hit=cache.has(meta.sha256),terrain=await load(meta);if(cancelled())return;
    const ids=points.map(p=>coordinateCell(meta,p)),routes:PlannedRoute[]=[];
    for(const mode of [{id:'shortest',name:'Shortest feasible',lambda:0},{id:'terrain',name:'Lower modelled terrain risk',lambda:input.settings.riskWeight}]){
      let cells:number[]=[],cost=0,expanded=0;
      for(let i=1;i<ids.length;i++){const leg=await findPathAsync(terrain,ids[i-1],ids[i],input.settings.maxSlope,mode.lambda,{cancelled,deadline:performance.now()+5000});cells=cells.concat(i===1?leg.cells:leg.cells.slice(1));cost+=leg.cost;expanded+=leg.expanded;}
      const measured=measurePath(terrain,cells,input.settings.maxSlope),snapping=points.map((p,i)=>marsDistance(p,cellCoordinate(meta,ids[i])));
      const route:RouteResult={...mode,cells,cost,expanded,...measured,snapping};
      routes.push({id:mode.id,name:mode.name,tier:'regional',coordinates:measured.coordinates,distance:measured.distance+snapping.reduce((a,b,i)=>a+b*(i===0||i===snapping.length-1?1:2),0),terrain:route,assessedDistance:measured.distance,snapping,connectors:points.map((p,i)=>[p,cellCoordinate(meta,ids[i])]),reached:[]});
    }
    if(!cancelled())self.postMessage({id:input.id,result:{routes,tier:'regional',reason:'Jezero CTX terrain · 20 m projected grid',meta,elapsedMs:performance.now()-started,cacheHits:hit?1:0,warnings:[]} satisfies PlannerResult});
  }catch(error){if(!cancelled())self.postMessage({id:input.id,error:error instanceof Error?error.message:String(error)});}
};
