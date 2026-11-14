"""Reproducible numerical derivatives; no colour-to-value inference or CGI at build."""
from pathlib import Path
import datetime, hashlib, json, math, re
import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public'/'processed'
R=3396190
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
PALETTES={
 'topography':['#29344a','#45677a','#728b7d','#afaa80','#e3d4b5'],
 'temperature':['#20202d','#7d2f58','#ce6045','#f5a458','#fff0a6'],
 'pressure':['#182d39','#3e6171','#7d958d','#c2c49b','#f4e6af'],
 'wind':['#202a45','#315e79','#3a927d','#94bc6e','#e9da87']
}
def sha(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def image(values,key,path,node_grid=False):
 lo,hi=float(np.nanmin(values)),float(np.nanmax(values))
 if node_grid:
  # Image pixels represent areas centred inside the extent, whereas the MCD
  # values are nodes ON its edges. Resample explicitly to avoid a half-cell shift.
  xx=(np.arange(1024)+.5)/1024*(values.shape[1]-1)
  yy=(np.arange(512)+.5)/512*(values.shape[0]-1)
  x0=np.floor(xx).astype(int);x1=np.minimum(x0+1,values.shape[1]-1);fx=xx-x0
  y0=np.floor(yy).astype(int);y1=np.minimum(y0+1,values.shape[0]-1);fy=yy-y0
  values=(values[y0[:,None],x0]*(1-fx)+values[y0[:,None],x1]*fx)*(1-fy[:,None])+(values[y1[:,None],x0]*(1-fx)+values[y1[:,None],x1]*fx)*fy[:,None]
 t=np.clip((values-lo)/(hi-lo),0,1)
 colors=np.array([[int(c[i:i+2],16) for i in (1,3,5)] for c in PALETTES[key]])
 rgba=np.zeros((*values.shape,4),dtype=np.uint8)
 for channel in range(3):rgba[:,:,channel]=np.interp(t,np.linspace(0,1,len(colors)),colors[:,channel]).round().astype(np.uint8)
 rgba[:,:,3]=np.isfinite(values)*255
 Image.fromarray(rgba).save(path)
 return [lo,hi]

# Preserve the source grid bounds; average elevation before finite differences.
src_path=ROOT/'all our mars info'/'Mars_MGS_MOLA_DEM_mosaic_global_463m.tif'
with rasterio.open(src_path) as src:
 dem=src.read(1,out_shape=(720,1440),out_dtype='float32',masked=True,resampling=Resampling.average).filled(np.nan)
 step=2*math.pi*R/1440
 lat=np.deg2rad(90-(np.arange(720)+.5)*.25)
 # Longitude is periodic. Latitude derivatives are centred except at the edges.
 dx=(np.roll(dem,-1,axis=1)-np.roll(dem,1,axis=1))/(2*step*np.cos(lat)[:,None])
 dy=np.gradient(dem.astype('float64'),step,axis=0)
 slope=np.degrees(np.arctan(np.hypot(dx,dy))).astype('<f4')
 valid=np.isfinite(dem)&np.isfinite(slope)
 dem[~valid]=np.nan;slope[~valid]=np.nan
 dem.astype('<f4').tofile(OUT/'mola-quarter-elevation.f32')
 slope.tofile(OUT/'mola-quarter-slope.f32')
 valid.astype('u1').tofile(OUT/'mola-quarter-valid.u8')
 source_hash=sha(src_path)
 meta={'id':'mola-quarter-degree','name':'Global MOLA coarse numerical terrain','width':1440,'height':720,'grid':'geographic','wrapX':True,'pixelSize':step,'angularStep':.25,'nativePixelSize':src.res[0],'transform':[.25,0,-180,0,-.25,90],'radius':R,'bounds':[-180,-90,180,90],'sha256':source_hash,'derivedSha256':sha(OUT/'mola-quarter-elevation.f32'),'sourceUrl':'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m','sourcePage':'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m','acquired':'Supplied original; original acquisition date not recorded','processedAt':NOW,'elevationUrl':'/processed/mola-quarter-elevation.f32','slopeUrl':'/processed/mola-quarter-slope.f32','validUrl':'/processed/mola-quarter-valid.u8','validCells':int(valid.sum()),'totalCells':int(valid.size),'examples':[[[130,-4],[131,-4]],[[179,0],[-179,0]]],'units':'m above areoid; degrees slope','processing':'Rasterio average resampling to 0.25 degree cells. Periodic longitude centred differences and latitude finite differences using Mars surface spacing. Edge latitude derivatives one-sided. All elevation and slope metrics use this derived grid, not native 463 m cells.','limitations':['Approximately 14.8 km north-south; east-west spacing varies with latitude.','Cell-average elevations hide local slopes and obstacles.','Global exploration context, not EVA navigation.','Source interpolation and physical elevation uncertainty are not quantified here.']}
 (OUT/'mola-quarter.json').write_text(json.dumps(meta,indent=2))
 topo_range=image(dem,'topography',OUT/'mola-quarter.png')

# The provider serializes longitude labels using integer formatting. Its actual
# axes are numpy.linspace(-180,180,64) and linspace(-90,90,48); see upstream mcd.py.
ascii_path=ROOT/'data'/'raw'/'mcd-v6.2-ls21.3-lt0-10m.txt'
if not ascii_path.exists():ascii_path=OUT/'mcd-v62-source.txt'
raw=ascii_path.read_text()
(OUT/'mcd-v62-source.txt').write_bytes(ascii_path.read_bytes())
sections=[]
for section in raw.split('### MCD_v6.2')[1:]:
 rows=[]
 for line in section.splitlines():
  if re.match(r'^[+-]\d+\s*\|\|',line):
   label,values=line.split('||');rows.append((int(label),[float(n) for n in values.split()]))
 if rows:sections.append(rows)
if len(sections)!=3:raise ValueError('Expected exactly temperature, pressure, wind sections')
fields={}
for key,rows,name,unit in zip(['temperature','pressure','wind'],sections,['Atmospheric temperature','Atmospheric pressure','Horizontal wind speed'],['K','Pa','m/s']):
 if len(rows)!=64 or any(len(v)!=48 for _,v in rows):raise ValueError('Unexpected MCD dimensions')
 actual_lon=np.linspace(-180,180,64)
 if [int(v) for v in actual_lon]!=[label for label,_ in rows]:raise ValueError('Longitude axis is not the documented producer grid')
 lat_line=next(l for l in raw.splitlines() if l.startswith('---- ||'))
 if not np.allclose([float(n) for n in lat_line.split('||')[1].split()],np.linspace(-90,90,48),atol=5e-5):raise ValueError('Unexpected latitude coordinates')
 values=np.array([v for _,v in rows],dtype='float64').T[::-1]
 if not np.isfinite(values).all():raise ValueError('Nonfinite model value')
 seam=float(np.max(np.abs(values[:,0]-values[:,-1])))
 # Equivalent date-line columns can differ slightly due to provider rounding.
 # Canonicalize them by their mean and record the maximum source discrepancy.
 values[:,0]=values[:,-1]=(values[:,0]+values[:,-1])/2
 field_range=image(values,key,OUT/('mcd-'+key+'.png'),node_grid=True)
 fields[key]={'name':name,'unit':unit,'range':field_range,'values':values.ravel().tolist(),'seamMaxDifference':seam,'palette':PALETTES[key]}
climate={'id':'mcd-6.2-ls21.3-lt0-10m','kind':'modelled climatology','version':'6.2','width':64,'height':48,'bounds':[-180,-90,180,90],'layout':'node-grid north to south, west to east, inclusive endpoints','longitudeStep':360/63,'latitudeStep':180/47,'context':'Ls 21.3° · local time 00:00 at every longitude · 10 m above local surface · climatology average solar scenario','providerGeneratedAt':re.search(r'Retrieved on: ([^\r\n]+)',raw).group(1),'acquiredAt':NOW,'sha256':sha(ascii_path),'sourceUrl':'https://www-mars.lmd.jussieu.fr/mcd_python/txt/9d08724c35c33d89f563a5dce3dcd448.txt','sourcePage':'https://www-mars.lmd.jussieu.fr/mcd_python/','credit':'Mars Climate Database © LMD / OU / IAA / ESA / CNES','terms':'https://www-mars.lmd.jussieu.fr/mars/access','axisEvidence':'https://github.com/aymeric-spiga/mcd-python/blob/master/mcd.py','processing':'Parsed numerical fields. Reconstructed unrounded linspace axes from provider code; integer ASCII longitude labels are truncated, not true node coordinates. Transposed longitude-major rows and reversed latitude to north-up. Duplicate date-line columns averaged; discrepancy recorded per field. Display is bilinear interpolation of these nodes.','limitations':['Model means, not live weather or extremes.','64 × 48 export sampling is not the native climate-model resolution.','MCD topographic correction does not imply local meteorological accuracy.','No climate field contributes to route cost.'],'fields':fields}
(OUT/'mcd-v62.json').write_text(json.dumps(climate,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
layers=[]
for key,name,unit,range_,palette,url,sampling,source in [('topography','MOLA elevation','m',topo_range,PALETTES['topography'],'/processed/mola-quarter.png','0.25° derived cells · ~14.8 km north–south',meta['sourcePage'])]+[(k,fields[k]['name'],fields[k]['unit'],fields[k]['range'],PALETTES[k],'/processed/mcd-'+k+'.png','64 × 48 export nodes · 5.714° lon × 3.830° lat',climate['sourcePage']) for k in fields]:
 layers.append({'id':key,'name':name,'unit':unit,'range':range_,'palette':palette,'imageUrl':url,'imageSize':[1440,720] if key=='topography' else [1024,512],'bounds':[-180,-90,180,90],'sampling':sampling,'nativeResolution':'463.0935 m projected source' if key=='topography' else 'Not established from web export','kind':'Measured terrain derivative' if key=='topography' else 'Modelled climatology','sourcePage':source,'dataUrl':meta['elevationUrl'] if key=='topography' else '/processed/mcd-v62.json','sha256':meta['derivedSha256'] if key=='topography' else climate['sha256'],'processedAt':NOW,'context':'Elevation above Martian areoid; cell average' if key=='topography' else climate['context'],'terms':'NASA / USGS source credits; no endorsement' if key=='topography' else climate['terms']})
(ROOT/'data'/'layers.json').write_text(json.dumps(layers,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'terrainValidPercent':valid.mean()*100,'terrainRange':topo_range,'terrainArrayBytes':dem.size*9,'climateSha256':climate['sha256'],'climateRanges':{k:f['range'] for k,f in fields.items()},'seamDifferences':{k:f['seamMaxDifference'] for k,f in fields.items()}},indent=2))
