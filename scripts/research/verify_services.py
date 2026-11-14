"""Snapshot NASA-discovered WMTS metadata; no guessed tile templates."""
from pathlib import Path
import concurrent.futures,datetime,json,urllib.request,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[2]
def get(url):
    with urllib.request.urlopen(url,timeout=25) as r:return r.read(),dict(r.headers)
config=json.loads(get('https://trek.nasa.gov/tiles/apidoc/config/config.json')[0])['mars']
catalog=json.loads(get(config['service_endpoints']['listVisibleLayersUrl'].replace('PROJECTIONTYPE','eq'))[0])['response']['docs']
ids=['Mars_Viking_MDIM21_ClrMosaic_global_232m','Mars_MGS_MOLA_ClrShade_merge_global_463m','JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0','JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd']
ns={'w':'http://www.opengis.net/wmts/1.0','o':'http://www.opengis.net/ows/1.1'}
def record(ident):
    item=next(d for d in catalog if d.get('productLabel')==ident)
    services=json.loads(get(config['service_endpoints']['getLayerServiceUrl']+item['item_UUID'])[0])['response']['docs']
    endpoint=next(s['endPoint'] for s in services if s['protocol']=='WMTS')
    url=endpoint+'/1.0.0/WMTSCapabilities.xml';content,headers=get(url);root=E.fromstring(content)
    layer=root.find('w:Contents/w:Layer',ns);matrix=root.find('w:Contents/w:TileMatrixSet',ns)
    ms=matrix.findall('w:TileMatrix',ns);resource=layer.find('w:ResourceURL',ns)
    bound=layer.find('o:WGS84BoundingBox',ns)
    lo=list(map(float,bound.findtext('o:LowerCorner',namespaces=ns).split()));hi=list(map(float,bound.findtext('o:UpperCorner',namespaces=ns).split()))
    result={'id':ident,'title':item['title'],'capabilities':url,'accessed':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':resource.attrib['template'],'format':resource.attrib['format'],'style':layer.findtext('w:Style/o:Identifier',namespaces=ns),'matrixSet':matrix.findtext('o:Identifier',namespaces=ns),'crs':matrix.findtext('o:SupportedCRS',namespaces=ns),'origin':list(map(float,ms[0].findtext('w:TopLeftCorner',namespaces=ns).split())),'tileSize':int(ms[0].findtext('w:TileWidth',namespaces=ns)),'bounds':lo+hi,'matrixIds':[m.findtext('o:Identifier',namespaces=ns) for m in ms],'sizes':[[int(float(m.findtext('w:MatrixWidth',namespaces=ns))),int(float(m.findtext('w:MatrixHeight',namespaces=ns)))] for m in ms],'resolutions':[360/(float(m.findtext('w:MatrixWidth',namespaces=ns))*int(m.findtext('w:TileWidth',namespaces=ns))) for m in ms],'cors':headers.get('Access-Control-Allow-Origin')}
    assert result['origin']==[-180,90]
    print(ident,len(ms),result['format'],flush=True)
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(record,ids))
(ROOT/'data/services.json').write_text(json.dumps(records,indent=2))
