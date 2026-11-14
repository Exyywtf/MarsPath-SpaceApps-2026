import { describe, expect, it } from 'vitest';
import { cellCoordinate, coordinateCell, findPath, measurePath, calculateRoutes, type Terrain } from '../../lib/routing';
import { MARS_RADIUS, marsDistance, normalizeLon, lonLatToProjected, projectedToLonLat } from '../../lib/mars';
function fixture():Terrain {return {meta:{id:'test',name:'controlled grid',width:7,height:7,transform:[20,0,0,0,-20,70],radius:MARS_RADIUS,pixelSize:20,bounds:[],sourceUrl:'',sourcePage:'',sha256:'',elevationUrl:'',slopeUrl:'',validUrl:'',examples:[]},elevation:new Float32Array(49),slope:new Float32Array(49),valid:new Uint8Array(49).fill(1)};}
describe('Mars coordinates',()=>{
  it('wraps longitudes, measures the antimeridian and uses Mars rather than Earth radius',()=>{
    expect(normalizeLon(343.03)).toBeCloseTo(-16.97);expect(normalizeLon(180)).toBe(-180);
    expect(marsDistance([0,0],[1,0])).toBeCloseTo(MARS_RADIUS*Math.PI/180,5);
    expect(marsDistance([179.9,0],[-179.9,0])).toBeCloseTo(MARS_RADIUS*Math.PI/900,5);
    expect(marsDistance([0,90],[100,90])).toBeLessThan(1e-8);
  });
  it('round-trips planetary coordinates and pixel centres',()=>{
    const ll:[number,number]=[77.43,18.46];const result=projectedToLonLat(...lonLatToProjected(ll));
    expect(result[0]).toBeCloseTo(ll[0],10);expect(result[1]).toBeCloseTo(ll[1],10);
    const t=fixture();for(let i=0;i<49;i++)expect(coordinateCell(t.meta,cellCoordinate(t.meta,i))).toBe(i);
    expect(coordinateCell(t.meta,[-10,0])).toBe(-1);
  });
});
describe('terrain A*',()=>{
  it('matches independent zero-heuristic search and analytic diagonal length',()=>{
    const t=fixture(),a=findPath(t,0,48,20,0),d=findPath(t,0,48,20,0,false);
    expect(a.cost).toBeCloseTo(d.cost,8);expect(a.cells).toHaveLength(7);
    expect(measurePath(t,a.cells,20).distance).toBeCloseTo(120*Math.SQRT2,4);
  });
  it('avoids blocked cells and disallows diagonal corner cutting',()=>{
    const t=fixture();t.valid[1]=0;t.valid[7]=0;
    expect(()=>findPath(t,0,48,20,0)).toThrow('No feasible route');
    expect(()=>findPath(t,-1,48,20,0)).toThrow('endpoint');
  });
  it('excludes nodata, excessive cell slopes and excessive edge grade',()=>{
    const t=fixture();t.elevation[24]=NaN;
    expect(findPath(t,0,48,20,0).cells).not.toContain(24);
    t.slope[0]=21;expect(()=>findPath(t,0,48,20,0)).toThrow('slope');
    t.slope[0]=0;t.elevation[0]=1000;expect(()=>findPath(t,0,48,20,0)).toThrow('No feasible route');
  });
  it('changes its path when terrain penalty makes a flatter detour preferable',()=>{
    const t=fixture();for(let x=1;x<6;x++)t.slope[3*7+x]=18;
    const a=findPath(t,21,27,20,0),b=findPath(t,21,27,20,8);
    expect(a.cells).not.toEqual(b.cells);
    expect(measurePath(t,b.cells,20).riskIntegral).toBeLessThan(measurePath(t,a.cells,20).riskIntegral);
  });
  it('routes through ordered user stops and calculates ascent/descent from elevations',()=>{
    const t=fixture();t.elevation[24]=2;
    const result=calculateRoutes(t,{endpoints:[cellCoordinate(t.meta,21),cellCoordinate(t.meta,27)],waypoints:[cellCoordinate(t.meta,24)],maxSlope:20,riskWeight:4});
    expect(result[0].cells).toContain(24);expect(result[0].ascent).toBe(2);expect(result[0].descent).toBe(2);
    expect(result[0].profile.at(-1)?.distance).toBe(result[0].distance);
  });
});
