import { marsDistance, lonLatToProjected, projectedToLonLat, type LonLat } from './mars';
export interface TerrainMeta {
  id:string;name:string;sourceUrl:string;sourcePage:string;sha256:string;width:number;height:number;
  transform:number[];radius:number;pixelSize:number;bounds:number[];elevationUrl:string;slopeUrl:string;validUrl:string;examples:number[][][];
}
export interface Terrain { meta:TerrainMeta; elevation:Float32Array;slope:Float32Array;valid:Uint8Array }
export interface RouteResult {
  id:string;name:string;lambda:number;coordinates:LonLat[];cells:number[];distance:number;ascent:number;descent:number;
  maxSlope:number;meanSlope:number;riskIntegral:number;cost:number;expanded:number;
  profile:{distance:number;elevation:number}[];snapping:number[];
}
export interface RouteRequest {endpoints:LonLat[];maxSlope:number;riskWeight:number;waypoints?:LonLat[]}
export function cellCoordinate(meta:TerrainMeta,index:number):LonLat {
  const x=index%meta.width,y=Math.floor(index/meta.width);
  return projectedToLonLat(meta.transform[2]+(x+.5)*meta.transform[0],meta.transform[5]+(y+.5)*meta.transform[4]);
}
export function coordinateCell(meta:TerrainMeta,point:LonLat):number {
  const [px,py]=lonLatToProjected(point);
  const x=Math.floor((px-meta.transform[2])/meta.transform[0]),y=Math.floor((py-meta.transform[5])/meta.transform[4]);
  if(x<0||x>=meta.width||y<0||y>=meta.height)return -1;
  return y*meta.width+x;
}
class MinHeap {
  private ids:number[]=[];private priorities:number[]=[];
  push(id:number,p:number){let i=this.ids.length;this.ids.push(id);this.priorities.push(p);while(i>0){const parent=(i-1)>>1;if(this.priorities[parent]<=p)break;this.ids[i]=this.ids[parent];this.priorities[i]=this.priorities[parent];i=parent;}this.ids[i]=id;this.priorities[i]=p;}
  pop():number|undefined {if(!this.ids.length)return undefined;const result=this.ids[0],id=this.ids.pop()!,p=this.priorities.pop()!;if(this.ids.length){let i=0;while(i*2+1<this.ids.length){let child=i*2+1;if(child+1<this.ids.length&&this.priorities[child+1]<this.priorities[child])child++;if(this.priorities[child]>=p)break;this.ids[i]=this.ids[child];this.priorities[i]=this.priorities[child];i=child;}this.ids[i]=id;this.priorities[i]=p;}return result;}
}
const neighbours=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
export interface PathResult {cells:number[];cost:number;expanded:number}
// Both validation and the worker use this frontier and identical tie breaking.
export function* pathSteps(terrain:Terrain,start:number,end:number,maxSlope:number,lambda:number,heuristic=true):Generator<void,PathResult,void>{
  const {meta,elevation,slope,valid}=terrain;
  if(!Number.isFinite(maxSlope)||maxSlope<=0||maxSlope>90||!Number.isFinite(lambda)||lambda<0)throw new Error('Invalid routing parameters.');
  const passable=(i:number)=>i>=0&&i<valid.length&&valid[i]===1&&Number.isFinite(elevation[i])&&Number.isFinite(slope[i])&&slope[i]<=maxSlope;
  if(!passable(start)||!passable(end))throw new Error('An endpoint or stop is outside valid terrain or exceeds the selected slope limit. Move it inside the coverage or adjust the model constraint.');
  const g=new Float64Array(valid.length);g.fill(Infinity);g[start]=0;
  const parent=new Int32Array(valid.length);parent.fill(-1);
  const closed=new Uint8Array(valid.length);const heap=new MinHeap();
  const target=cellCoordinate(meta,end);
  const h=(i:number)=>heuristic?marsDistance(cellCoordinate(meta,i),target):0;
  heap.push(start,h(start));let expanded=0;
  while(true){
    const u=heap.pop();if(u===undefined)throw new Error('No feasible route exists within this terrain coverage and slope constraint.');
    if(closed[u])continue;
    if(u===end){const cells=[u];while(cells[cells.length-1]!==start){const p=parent[cells[cells.length-1]];if(p<0)throw new Error('Route reconstruction failed.');cells.push(p);}return {cells:cells.reverse(),cost:g[u],expanded};}
    closed[u]=1;expanded++;
    if(expanded%2048===0)yield;
    const ux=u%meta.width,uy=Math.floor(u/meta.width),a=cellCoordinate(meta,u);
    for(const [dx,dy] of neighbours){
      const x=ux+dx,y=uy+dy;if(x<0||x>=meta.width||y<0||y>=meta.height)continue;
      const v=y*meta.width+x;if(closed[v]||!passable(v))continue;
      if(dx&&dy&&(!passable(uy*meta.width+x)||!passable(y*meta.width+ux)))continue;
      const d=marsDistance(a,cellCoordinate(meta,v));
      const grade=Math.atan2(Math.abs(elevation[v]-elevation[u]),d)*180/Math.PI;
      if(grade>maxSlope)continue;
      const s=Math.max(slope[u],slope[v],grade);
      const edge=d*(1+lambda*(s/maxSlope)**2);
      const candidate=g[u]+edge;
      if(candidate<g[v]){g[v]=candidate;parent[v]=u;heap.push(v,candidate+h(v));}
    }
  }
}
export function findPath(terrain:Terrain,start:number,end:number,maxSlope:number,lambda:number,heuristic=true):PathResult{
  const steps=pathSteps(terrain,start,end,maxSlope,lambda,heuristic);
  let step=steps.next();while(!step.done)step=steps.next();return step.value;
}
export async function findPathAsync(terrain:Terrain,start:number,end:number,maxSlope:number,lambda:number,control:{cancelled:()=>boolean;deadline:number}):Promise<PathResult>{
  const steps=pathSteps(terrain,start,end,maxSlope,lambda);
  let step=steps.next();
  while(!step.done){
    if(control.cancelled())throw new Error('Cancelled');
    if(performance.now()>control.deadline)throw new Error('Terrain search exceeded the five-second budget. Try closer points or geographic planning.');
    await new Promise<void>(resolve=>setTimeout(resolve,0));step=steps.next();
  }
  if(control.cancelled())throw new Error('Cancelled');return step.value;
}
export function measurePath(terrain:Terrain,cells:number[],maxSlope:number):Pick<RouteResult,'distance'|'ascent'|'descent'|'maxSlope'|'meanSlope'|'riskIntegral'|'profile'|'coordinates'>{
  let distance=0,ascent=0,descent=0,max=terrain.slope[cells[0]],weighted=0,riskIntegral=0;
  const coordinates=cells.map(i=>cellCoordinate(terrain.meta,i));
  const profile=[{distance:0,elevation:terrain.elevation[cells[0]]}];
  for(let i=1;i<cells.length;i++){
    const d=marsDistance(coordinates[i-1],coordinates[i]);const dz=terrain.elevation[cells[i]]-terrain.elevation[cells[i-1]];
    const grade=Math.atan2(Math.abs(dz),d)*180/Math.PI;
    const slope=Math.max(terrain.slope[cells[i-1]],terrain.slope[cells[i]],grade);
    distance+=d;ascent+=Math.max(0,dz);descent+=Math.max(0,-dz);max=Math.max(max,slope);weighted+=d*slope;riskIntegral+=d*(slope/maxSlope)**2;
    profile.push({distance,elevation:terrain.elevation[cells[i]]});
  }
  return {distance,ascent,descent,maxSlope:max,meanSlope:distance?weighted/distance:max,riskIntegral,profile,coordinates};
}
export function calculateRoutes(terrain:Terrain,request:RouteRequest):RouteResult[]{
  if(request.endpoints.length!==2)throw new Error('Place a start and destination.');
  const points=[request.endpoints[0],...(request.waypoints??[]),request.endpoints[1]];
  const ids=points.map(p=>coordinateCell(terrain.meta,p));
  return [{id:'shortest',name:'Shortest feasible',lambda:0},{id:'terrain',name:'Lower terrain penalty',lambda:request.riskWeight}].map(mode=>{
    let cells:number[]=[],cost=0,expanded=0;
    for(let i=1;i<ids.length;i++){const leg=findPath(terrain,ids[i-1],ids[i],request.maxSlope,mode.lambda);cells=cells.concat(i===1?leg.cells:leg.cells.slice(1));cost+=leg.cost;expanded+=leg.expanded;}
    return {...mode,cells,cost,expanded,...measurePath(terrain,cells,request.maxSlope),snapping:points.map((p,i)=>marsDistance(p,cellCoordinate(terrain.meta,ids[i])))};
  });
}
