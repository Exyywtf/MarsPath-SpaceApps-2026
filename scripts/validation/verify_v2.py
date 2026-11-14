"""Independent Dijkstra, full-path metrics, source samples and climate registration."""
from pathlib import Path
import datetime,hashlib,heapq,json,math,time
import numpy as np
import rasterio
from rasterio.windows import Window
ROOT=Path(__file__).resolve().parents[2]
cases=json.loads((ROOT/'data/validation/v2-routes.json').read_text())['cases']
reports=[];loaded={};search_cache={}
def terrain(name):
 if name in loaded:return loaded[name]
 m=json.loads((ROOT/'public/processed'/('jezero.json' if name=='jezero-ctx-20m' else 'mola-quarter.json')).read_text())
 e=np.fromfile(ROOT/('public'+m['elevationUrl']),dtype='<f4');s=np.fromfile(ROOT/('public'+m['slopeUrl']),dtype='<f4');v=np.fromfile(ROOT/('public'+m['validUrl']),dtype='u1')
 w,h=m['width'],m['height'];a,_,x0,_,b,y0=m['transform'];R=m['radius']
 if m.get('grid')=='geographic':
  lons=np.radians(x0+(np.arange(w)+.5)*a);lats=np.radians(y0+(np.arange(h)+.5)*b)
 else:lons=(x0+(np.arange(w)+.5)*a)/R;lats=(y0+(np.arange(h)+.5)*b)/R
 good=(v==1)&np.isfinite(e)&np.isfinite(s)
 def cell(point):
  lon=(point[0]+180)%360-180;lat=point[1]
  px,py=(lon,lat) if m.get('grid')=='geographic' else (math.radians(lon)*R,math.radians(lat)*R)
  x=int(math.floor((px-x0)/a));y=max(0,min(h-1,int(math.floor((py-y0)/b))));return y*w+x
 def dist(u,vv):
  uy,ux=divmod(u,w);vy,vx=divmod(vv,w)
  hav=math.sin((lats[vy]-lats[uy])/2)**2+math.cos(lats[uy])*math.cos(lats[vy])*math.sin((lons[vx]-lons[ux])/2)**2
  return 2*R*math.asin(math.sqrt(min(1,hav)))
 def search(start,end,limit,weight):
  key=(name,start,end,limit,weight)
  if key in search_cache:return search_cache[key]
  assert good[start] and good[end] and s[start]<=limit and s[end]<=limit
  costs={start:0.};queue=[(0.,start)];closed=set()
  while queue:
   cost,u=heapq.heappop(queue)
   if u in closed:continue
   if u==end:search_cache[key]=(cost,len(closed));return cost,len(closed)
   closed.add(u);uy,ux=divmod(u,w)
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     if dx==dy==0:continue
     x,y=ux+dx,uy+dy
     if m.get('wrapX'):x%=w
     if not(0<=x<w and 0<=y<h):continue
     vv=y*w+x
     if vv in closed or not good[vv] or s[vv]>limit:continue
     if dx and dy and (not good[uy*w+x] or not good[y*w+ux] or s[uy*w+x]>limit or s[y*w+ux]>limit):continue
     d=dist(u,vv);grade=math.degrees(math.atan2(abs(float(e[vv])-float(e[u])),d))
     if grade>limit:continue
     risk=max(float(s[u]),float(s[vv]),grade)/limit
     trial=cost+d*(1+weight*risk*risk)
     if trial<costs.get(vv,math.inf):costs[vv]=trial;heapq.heappush(queue,(trial,vv))
  raise AssertionError('Independent solver found no path')
 loaded[name]=(m,e,s,v,cell,dist,search);return loaded[name]
for case in cases:
 m,e,s,v,cell,dist,search=terrain(case['metaId'])
 for route in case['routes']:
  begin=time.monotonic();stops=[cell(p) for p in route['stops']];optimal=0;expanded=0
  for a,b in zip(stops,stops[1:]):
   cost,count=search(a,b,case['request']['settings']['maxSlope'],route['lambda']);optimal+=cost;expanded+=count
  cells=route['cells'];distance=0;ascent=0;descent=0;maximum=float(s[cells[0]])
  for a,b in zip(cells,cells[1:]):
   d=dist(a,b);dz=float(e[b])-float(e[a]);distance+=d;ascent+=max(0,dz);descent+=max(0,-dz);maximum=max(maximum,float(s[a]),float(s[b]),math.degrees(math.atan2(abs(dz),d)))
  delta=abs(optimal-route['cost']);assert delta<1e-4,(case['request']['id'],route['id'],delta)
  assert abs(distance-route['distance'])<1e-4
  assert abs(ascent-route['ascent'])<1e-6 and abs(descent-route['descent'])<1e-6 and abs(maximum-route['maxSlope'])<1e-6
  assert all(v[i]==1 and math.isfinite(float(e[i])) for i in cells)
  source=ROOT/('data/raw/jezero-ctx-20m.tif' if m['id']=='jezero-ctx-20m' else 'all our mars info/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif')
  errors=[]
  with rasterio.open(source) as src:
   for i in [cells[0],cells[len(cells)//2],cells[-1]]:
    y,x=divmod(i,m['width'])
    if m['id']=='jezero-ctx-20m':
     raw=float(src.read(1,window=Window(x,y,1,1))[0,0]);assert raw==float(e[i]);errors.append(0.)
    else:
     # 0.25 degree cell covers exactly 32 x 32 native MOLA source cells.
     raw=src.read(1,window=Window(x*32,y*32,32,32),masked=True);error=abs(float(raw.mean())-float(e[i]));assert error<=1.,error;errors.append(error)
  report={'case':case['request']['id'],'tier':case['tier'],'route':route['id'],'lambda':route['lambda'],'distanceM':distance,'ascentM':ascent,'descentM':descent,'maxSlopeDegrees':maximum,'absoluteCostDifference':delta,'sourceSampleMaxDifferenceM':max(errors),'expandedDijkstra':expanded,'seconds':round(time.monotonic()-begin,3),'scienceStops':route['scienceStops']}
  reports.append(report);print(json.dumps(report),flush=True)
# Retained ASCII bytes and numerical field identity; producer's printed labels
# are integer-truncated. Compare actual raw field nodes, not image colours.
raw=(ROOT/'public/processed/mcd-v62-source.txt').read_bytes();climate=json.loads((ROOT/'public/processed/mcd-v62.json').read_text())
assert hashlib.sha256(raw).hexdigest()==climate['sha256']
sections=[]
for part in raw.decode().split('### MCD_v6.2')[1:]:
 rows=[line for line in part.splitlines() if line.startswith(('+','-')) and '||' in line and not line.startswith('----')]
 if rows:sections.append([[float(n) for n in line.split('||')[1].split()] for line in rows])
for key,rows in zip(['temperature','pressure','wind'],sections):
 for ix,iy in [(13,31),(30,20),(50,12)]:
  assert climate['fields'][key]['values'][(47-iy)*64+ix]==rows[ix][iy]
report={'status':'passed','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Independent Python Dijkstra without heuristic, exact spherical edge distances, full-path metric recalculation, original GeoTIFF samples and numerical climate-node identity.','checks':reports,'climateSourceSha256':climate['sha256'],'climateInteriorNodesCompared':9,'globalSourceSampleToleranceM':1,'limitations':'Numerical consistency only. Coarse average MOLA source cells can differ by up to 1 m from native-window means due to stored int16 overviews/rounding; no positional ground-truth or astronaut safety validation.'}
if __import__('sys').argv[1:] == ['--write']:
 (ROOT/'data/validation/v2-independent.json').write_text(json.dumps(report,indent=2))
print('PASSED',len(reports),'route calculations and 9 climate node comparisons',flush=True)
