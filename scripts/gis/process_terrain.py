"""Download the published CTX DTM; preserve raw input and export native-resolution grids."""
from pathlib import Path
import concurrent.futures, datetime, hashlib, json, math, urllib.request
import numpy as np
import rasterio
from rasterio.windows import Window
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'data'/'raw';RAW.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'public'/'processed';OUT.mkdir(parents=True,exist_ok=True)
URL='https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
FILE=RAW/'jezero-ctx-20m.tif'

def fetch(start,end):
    req=urllib.request.Request(URL,headers={'Range':f'bytes={start}-{end}','User-Agent':'MarsPath research contact via GitHub Exyywtf'})
    with urllib.request.urlopen(req,timeout=35) as r:
        content=r.read()
        if r.status==200:
            return content[start:end+1]
        if r.status!=206 or len(content)!=end-start+1:raise ValueError('Incomplete raster range')
        return content

if not FILE.exists():
    try:
        content=fetch(0,9662386)
    except Exception:
        chunks=[(i,min(i+65535,9662386)) for i in range(0,9662387,65536)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as p:content=b''.join(p.map(lambda x:fetch(*x),chunks))
    if len(content)!=9662387:raise ValueError('Unexpected source size')
    FILE.write_bytes(content)

with rasterio.open(FILE) as src:
    dem=src.read(1)
    # The source nodata decimal is just beyond finite float32 range. Mask actual
    # extreme sentinel values and nonfinite values explicitly before arithmetic.
    valid=np.isfinite(dem)&(dem>-3e38)
    dem=np.where(valid,dem,np.nan).astype('<f4')
    transform=src.transform
    radius=src.crs.to_dict().get('R',3396190)
    factor=180/(math.pi*float(radius))
    bounds=[src.bounds.left*factor,src.bounds.bottom*factor,src.bounds.right*factor,src.bounds.top*factor]
    # Derivatives use the actual latitude-dependent east/west surface distance.
    lat=(transform.f+(np.arange(src.height)+.5)*transform.e)/3396190
    dy,dx=np.gradient(dem.astype('float64'))
    dx=dx/(abs(transform.a)*np.cos(lat)[:,None]);dy=dy/abs(transform.e)
    slope=np.degrees(np.arctan(np.hypot(dx,dy)))
    valid &= np.isfinite(slope)
    slopes=np.where(valid,slope,np.nan).astype('<f4')
    dem[~valid]=np.nan
    dem.tofile(OUT/'jezero-elevation.f32')
    slopes.tofile(OUT/'jezero-slope.f32')
    valid.astype('uint8').tofile(OUT/'jezero-valid.u8')
    provenance={'id':'jezero-ctx-20m','name':'Jezero CTX numerical terrain','sourceUrl':URL,'sourcePage':'https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0','sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'acquired':datetime.datetime.now(datetime.timezone.utc).isoformat(),'width':src.width,'height':src.height,'transform':[transform.a,transform.b,transform.c,transform.d,transform.e,transform.f],'crs':src.crs.to_wkt(),'radius':3396190,'units':'m elevation; degrees slope','pixelSize':20,'bounds':bounds,'validCells':int(valid.sum()),'totalCells':int(valid.size),'elevationRange':[float(np.nanmin(dem)),float(np.nanmax(dem))],'elevationUrl':'/processed/jezero-elevation.f32','slopeUrl':'/processed/jezero-slope.f32','validUrl':'/processed/jezero-valid.u8','processing':'Native grid, no elevation resampling. Invalid sentinel and nonfinite cells masked. Centred finite differences; edge derivatives one-sided. Slope unavailable next to missing terrain. Little-endian float32 arrays.','limitations':['20 m projected grid does not resolve rocks or guarantee traversability.','High-resolution imagery is not high-resolution elevation.','Grid slope and edge grade do not capture every hazard.']}
    # Starting endpoints are deterministic valid low-slope terrain examples, not
    # claimed landmarks, rover tracks, or astronaut landing locations.
    examples=[]
    for fraction in [(0.48,0.50,0.56,0.52),(0.52,0.48,0.60,0.55),(0.44,0.55,0.53,0.58)]:
        pair=[]
        for fx,fy in [(fraction[0],fraction[1]),(fraction[2],fraction[3])]:
            col,row=int(src.width*fx),int(src.height*fy)
            rr,cc=np.where(valid[max(0,row-50):row+51,max(0,col-50):col+51] & (slopes[max(0,row-50):row+51,max(0,col-50):col+51]<10))
            if len(rr)==0:raise ValueError('No valid demonstration endpoint')
            idx=np.argmin((rr-50)**2+(cc-50)**2);r=int(rr[idx]+row-50);c=int(cc[idx]+col-50)
            x,y=transform*(c+.5,r+.5);pair.append([x*factor,y*factor])
        examples.append(pair)
    provenance['examples']=examples
    (OUT/'jezero.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
    # A numerical elevation legend overlay, with alpha = valid terrain only.
    t=np.clip((dem-np.nanmin(dem))/(np.nanmax(dem)-np.nanmin(dem)),0,1)
    rgba=np.zeros((*dem.shape,4),dtype='uint8')
    rgba[:,:,0]=np.nan_to_num(70+180*t).astype('uint8');rgba[:,:,1]=np.nan_to_num(145-60*t).astype('uint8');rgba[:,:,2]=np.nan_to_num(180-120*t).astype('uint8');rgba[:,:,3]=valid.astype('uint8')*155
    Image.fromarray(rgba).save(OUT/'jezero-elevation.png')
    print(json.dumps({k:provenance[k] for k in ['width','height','validCells','bounds','elevationRange','examples','sha256']},indent=2))

# Overview is a small numeric derivative, never a replacement for the source.
global_file=ROOT/'all our mars info'/'Mars_MGS_MOLA_DEM_mosaic_global_463m.tif'
if global_file.exists():
    from rasterio.enums import Resampling
    with rasterio.open(global_file) as src:
        overview=src.read(1,out_shape=(360,720),masked=True,resampling=Resampling.average).filled(-32768).astype('<i2')
        overview.tofile(OUT/'mola-overview.i16')
        meta={'width':720,'height':360,'bounds':[-180,-90,180,90],'nodata':-32768,'units':'m above areoid','method':'Rasterio average overview, 0.5° bins, not local terrain','sourceUrl':'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m'}
        (OUT/'mola-overview.json').write_text(json.dumps(meta,indent=2))
