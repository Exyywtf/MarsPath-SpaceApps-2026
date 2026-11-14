"""Independent Python Dijkstra validation of the TypeScript routes on real terrain."""
from pathlib import Path
import heapq, json, math, time
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
meta=json.loads((ROOT/'public/processed/jezero.json').read_text())
cases=json.loads((ROOT/'data/validation/routes.json').read_text())
elevation=np.fromfile(ROOT/'public/processed/jezero-elevation.f32',dtype='<f4')
slope=np.fromfile(ROOT/'public/processed/jezero-slope.f32',dtype='<f4')
valid=np.fromfile(ROOT/'public/processed/jezero-valid.u8',dtype='u1')
w,h=meta['width'],meta['height'];a,_,x0,_,e,y0=meta['transform'];R=meta['radius']
lats=[(y0+(row+.5)*e)/R for row in range(h)]
lons=[(x0+(col+.5)*a)/R for col in range(w)]

def dist(u,v):
    yu,xu=divmod(u,w);yv,xv=divmod(v,w)
    hav=math.sin((lats[yv]-lats[yu])/2)**2+math.cos(lats[yu])*math.cos(lats[yv])*math.sin((lons[xv]-lons[xu])/2)**2
    return 2*R*math.asin(math.sqrt(min(1,hav)))

def search(start,end,limit,weight):
    good=(valid==1)&np.isfinite(elevation)&np.isfinite(slope)&(slope<=limit)
    costs={start:0.0};heap=[(0.0,start)];closed=set();expanded=0
    while heap:
        cost,u=heapq.heappop(heap)
        if u in closed:continue
        if u==end:return cost,expanded
        closed.add(u);expanded+=1;uy,ux=divmod(u,w)
        for dy in [-1,0,1]:
            for dx in [-1,0,1]:
                if dx==dy==0:continue
                x,y=ux+dx,uy+dy
                if not (0<=x<w and 0<=y<h):continue
                v=y*w+x
                if v in closed or not good[v]:continue
                if dx and dy and (not good[uy*w+x] or not good[y*w+ux]):continue
                d=dist(u,v);grade=math.degrees(math.atan2(abs(float(elevation[v])-float(elevation[u])),d))
                if grade>limit:continue
                risk=max(float(slope[u]),float(slope[v]),grade)/limit
                trial=cost+d*(1+weight*risk*risk)
                if trial<costs.get(v,math.inf):costs[v]=trial;heapq.heappush(heap,(trial,v))
    raise RuntimeError('Independent solver found no route')

reports=[]
for case in cases['cases']:
    for route in case['routes']:
        begin=time.monotonic();cells=route['cells'];cost,expanded=search(cells[0],cells[-1],case['maxSlope'],route['lambda'])
        difference=abs(cost-route['cost']);assert difference<1e-4,(case['id'],route['id'],difference)
        distance=sum(dist(u,v) for u,v in zip(cells,cells[1:]));assert abs(distance-route['distance'])<1e-4
        # Independently compare binary derivative samples with the original GeoTIFF.
        import rasterio
        with rasterio.open(ROOT/'data/raw/jezero-ctx-20m.tif') as src:
            for i in [cells[0],cells[len(cells)//2],cells[-1]]:
                row,col=divmod(i,w);raw=float(src.read(1,window=rasterio.windows.Window(col,row,1,1))[0,0]);assert raw==float(elevation[i])
        report={'case':case['id'],'route':route['id'],'distanceM':route['distance'],'ascentM':route['ascent'],'descentM':route['descent'],'maxSlopeDegrees':route['maxSlope'],'typescriptCost':route['cost'],'independentPythonCost':cost,'absoluteCostDifference':difference,'expandedDijkstra':expanded,'seconds':round(time.monotonic()-begin,3),'sourceSamplesMatch':True}
        reports.append(report);print(json.dumps(report),flush=True)
if __import__('sys').argv[1:] == ['--write']:
    (ROOT/'data/validation/independent.json').write_text(json.dumps({'terrainSha256':meta['sha256'],'method':'Independent Python Dijkstra (no heuristic), exact spherical edge distances, original GeoTIFF spot checks','results':reports,'limitations':'Numerical consistency validation only; no ground-truth astronaut safety or obstacle validation.'},indent=2))
