import { expect,it } from 'vitest';
import { resolveCapability } from '../../lib/mission';
import { defaultSettings, type PlannerRequest } from '../../lib/planner';
import { coordinateCell,cellCoordinate,findPath,type Terrain } from '../../lib/routing';
import { MARS_RADIUS } from '../../lib/mars';
const request=(a:[number,number],b:[number,number]):PlannerRequest=>({id:1,draft:{start:a,end:b,waypoints:[]},settings:defaultSettings});
it('chooses actual coverage and exposes unresolved subcell and polar legs',()=>{
  expect(resolveCapability(request([77.42,18.46],[77.46,18.45])).tier).toBe('regional');
  expect(resolveCapability(request([179,0],[-179,0])).tier).toBe('coarse');
  expect(resolveCapability(request([0,90],[1,88])).tier).toBe('geographic');
  expect(resolveCapability(request([0,0],[.01,0])).tier).toBe('geographic');
});
it('wraps global graph neighbours without wrapping latitude or cutting corners',()=>{
  const meta={id:'global-test',name:'test',width:8,height:4,grid:'geographic',wrapX:true,transform:[45,0,-180,0,-45,90],radius:MARS_RADIUS,pixelSize:1,bounds:[-180,-90,180,90],sourceUrl:'',sourcePage:'',sha256:'',elevationUrl:'',slopeUrl:'',validUrl:'',examples:[]};
  const t:Terrain={meta,elevation:new Float32Array(32),slope:new Float32Array(32),valid:new Uint8Array(32).fill(1)};
  for(let i=0;i<32;i++)expect(coordinateCell(meta,cellCoordinate(meta,i))).toBe(i);
  expect(coordinateCell(meta,[0,91])).toBe(-1);expect(coordinateCell(meta,[180,0])).toBe(coordinateCell(meta,[-180,0]));
  const result=findPath(t,8,15,20,0);expect(result.cells).toEqual([8,15]);
  t.valid[15]=0;expect(()=>findPath(t,8,15,20,0)).toThrow('endpoint');
});
