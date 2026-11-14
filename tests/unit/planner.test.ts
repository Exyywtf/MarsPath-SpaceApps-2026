import { expect, it } from 'vitest';
import { parseCoordinate, greatCircle, geographicRoute, splitDateLine, defaultSettings, routeScore } from '../../lib/planner';
import { marsDistance, MARS_RADIUS } from '../../lib/mars';
it('validates coordinates and normalizes both longitude conventions',()=>{
  expect(parseCoordinate('18.5','343.03')).toEqual([-16.970000000000027,18.5]);
  expect(()=>parseCoordinate('','0')).toThrow('both');expect(()=>parseCoordinate('91','0')).toThrow('Latitude');
  expect(()=>parseCoordinate('0','Infinity')).toThrow('longitude');
});
it('uses Mars great-circle lengths across the date line and stable antipodal arcs',()=>{
  const route=geographicRoute({start:[179,0],end:[-179,0],waypoints:[]});
  expect(route.distance).toBeCloseTo(2*Math.PI*MARS_RADIUS/180,5);expect(route.terrain).toBeUndefined();
  const parts=splitDateLine(route.coordinates);expect(parts).toHaveLength(2);
  for(const part of parts)for(let i=1;i<part.length;i++)expect(Math.abs(part[i][0]-part[i-1][0])).toBeLessThanOrEqual(180);
  const arc=greatCircle([0,0],[180,0]);let distance=0;for(let i=1;i<arc.length;i++){expect(arc[i].every(Number.isFinite)).toBe(true);distance+=marsDistance(arc[i-1],arc[i]);}
  expect(distance).toBeCloseTo(Math.PI*MARS_RADIUS,3);
  expect(greatCircle([0,90],[130,90]).flat().every(Number.isFinite)).toBe(true);
});
it('preserves ordered stops and removes unavailable science from scoring',()=>{
  const route=geographicRoute({start:[0,0],waypoints:[[1,0]],end:[0,0]});
  expect(route.distance).toBeCloseTo(2*marsDistance([0,0],[1,0]),6);
  expect(routeScore([route],defaultSettings)).toEqual([0]);
});
