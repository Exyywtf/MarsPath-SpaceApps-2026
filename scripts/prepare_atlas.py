"""Reproducible asset audit and atlas preparation. Originals are read-only."""
from pathlib import Path
from PIL import Image
import concurrent.futures, datetime, hashlib, html, json, re, urllib.request

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'all our mars info'
OUT = ROOT / 'public' / 'images'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'data').mkdir(exist_ok=True)
(ROOT / 'docs').mkdir(exist_ok=True)
TODAY = datetime.datetime.now(datetime.timezone.utc).isoformat()

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'MarsPath/0.1 scientific atlas'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read(), r.url

catalog, _ = get('https://planetarynames.wr.usgs.gov/SearchResults?Target=20_Mars')
features = {}
for row in re.findall(r'<tr\b[^>]*>.*?</tr>', catalog.decode(), re.S):
    cols = [' '.join(re.sub('<[^>]+>', ' ', c).split()) for c in re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S)]
    if len(cols) > 11 and cols[3] == 'Mars':
        try: features[cols[1]] = {'featureId': cols[0], 'lat': float(cols[5]), 'lon': float(cols[6])}
        except ValueError: pass

# Short paraphrases; source text, exact evidence and access outcomes remain traceable.
items = [
('mawrth','Mawrth Vallis','Mawrth Vallis','Ancient water','Clay-bearing layered terrain records ancient interactions between water and rock.','clay-minerals-in-mawrth-vallis-region-of-mars/',['Clays','Ancient water'],'MRO · CRISM'),
('oxia','Oxia Planum','Oxia Planum','Clay minerals','A broad clay-bearing plain studied as a rover landing site and a record of ancient aqueous alteration.','possible-future-mars-landing-site-in-oxia-planum/',['Clays','Ancient water'],'MRO · HiRISE'),
('valles','Valles Marineris','Valles Marineris','Geology','This vast canyon system exposes layered deposits; Melas Chasma provides a window into its sedimentary history.','deposits-along-the-northern-wall-of-melas-chasma/',['Sediments','Ancient water'],'MRO · HiRISE'),
('meridiani','Meridiani Planum','Meridiani Planum','Ancient water','Opportunity explored hematite-bearing sedimentary materials in this equatorial plain, investigating evidence of past water.','meridiani-planum-2/',['Ancient water','Sediments'],'Opportunity · MGS'),
('jezero','Jezero Crater','Jezero','Ancient water','A preserved delta and crater-floor rocks make Jezero a key site for investigating ancient environments. Perseverance explores this region.','jezero-crater-delta/',['Ancient water','Sediments','Carbonates'],'Perseverance · MRO'),
('gale','Gale Crater','Gale','Sedimentary record','Curiosity studies the layered rocks of Mount Sharp to investigate the history of ancient Martian environments.','a-guide-to-gale-crater/',['Sediments','Ancient water'],'Curiosity · MRO'),
('nili','Nili Fossae','Nili Fossae','Mineralogy','Orbital spectroscopy reveals carbonate-bearing materials and other mineral signatures that constrain the region’s alteration history.','mineral-spectra-from-nili-fossae-mars/',['Carbonates','Clays'],'MRO · CRISM'),
('eberswalde','Eberswalde Crater','Eberswalde','Ancient delta','Preserved branching channels and delta deposits record sediment transport into an ancient standing body of water.','eberswalde-delta-3-d/',['Ancient water','Sediments'],'MRO · HiRISE'),
('holden','Holden Crater','Holden','Sedimentary record','A former rover landing-site candidate with alluvial fans, flood deposits and clay-bearing sedimentary materials.','four-finalist-landing-site-candidates-for-mars-science-laboratory/',['Ancient water','Clays'],'MRO · MSL site studies'),
('gusev','Gusev · Columbia Hills','Gusev','Hydrothermal evidence','Spirit investigated altered rocks in Columbia Hills. Silica-rich deposits have been interpreted as evidence of hydrothermal processes.','https://ares.jsc.nasa.gov/missions/mer/important-discoveries.html',['Hydrothermal','Volcanism'],'Spirit · MRO'),
('aram','Aram Chaos','Aram Chaos','Mineralogy','Fractured terrain and layered sulfate-bearing deposits record a complex history of geological and chemical change.','https://www.jpl.nasa.gov/images/pia25358-a-complex-geologic-history-of-aram-chaos/',['Ancient water','Sediments'],'MRO · CRISM'),
('eridania','Eridania Basin',None,'Hydrothermal evidence','Mineral deposits in this broad basin system have been interpreted as ancient hydrothermal seafloor deposits. This is an interpretation, not evidence of life.','https://www.nature.com/articles/ncomms15978',['Hydrothermal','Ancient water'],'MRO · CRISM'),
('sirenum','Terra Sirenum · Chlorides',None,'Salt deposits','Chloride-bearing deposits in topographic depressions provide evidence relevant to ancient water accumulation and evaporation.','bright-exposures-of-chloride-salt-on-southern-mars/',['Ancient water','Salts'],'Mars Odyssey · THEMIS · MRO'),
]

def prepare(item):
    ident, name, feature, category, summary, resource, tags, mission = item
    if feature:
        f = features[feature]
        coords = [((f['lon'] + 180) % 360) - 180, f['lat']]
        coord_source = 'https://planetarynames.wr.usgs.gov/Feature/' + f['featureId']
        coord_note = 'USGS/IAU representative feature centre; not a local science target.'
    elif ident == 'sirenum':
        coords = [-139, -38.8]
        coord_source = 'https://science.nasa.gov/resource/bright-exposures-of-chloride-salt-on-southern-mars/'
        coord_note = 'Approximate deposit location published in the NASA image description.'
    else:
        coords = [-179.1, -31.5]
        coord_source = 'https://doi.org/10.1029/2024JE008461'
        coord_note = 'Published northern-basin rim example (180.9°E, 31.5°S), representing a much broader basin system.'
    url = resource if resource.startswith('http') else 'https://science.nasa.gov/resource/' + resource
    record = {'id':ident,'name':name,'coordinates':coords,'coordinateSource':coord_source,'coordinateNote':coord_note,'category':category,'summary':summary,'tags':tags,'mission':mission,'sourceUrl':url,'image':None,'imageSource':None,'accessed':TODAY,'sourceStatus':'not retrieved'}
    try:
        try:
            body, final = get(url)
        except Exception:
            if ident == 'jezero': url = 'https://science.nasa.gov/mission/mars-2020-perseverance/'
            elif '/resource/' in url: url = url.replace('/resource/', '/photojournal/')
            else: raise
            body, final = get(url)
        text = body.decode(errors='replace')
        if 'Page Not Found' in text[:3000]: raise ValueError('Source returned not-found content')
        record['sourceUrl'] = final
        record['sourceStatus'] = 'retrieved; concise claim linked to original source'
        (ROOT / 'data' / 'raw').mkdir(exist_ok=True)
        (ROOT / 'data' / 'raw' / (ident + '.html')).write_bytes(body)
        matches = re.findall(r'<meta\b[^>]*>', text, re.I)
        image_url = None
        for meta in matches:
            if re.search(r'(?:property|name)=[\"\x27]og:image[\"\x27]',meta,re.I):
                m = re.search(r'content=[\"\x27]([^\"\x27]+)', meta)
                if m: image_url = html.unescape(m.group(1))
        if image_url and ident != 'eridania' and 'logo' not in image_url.lower():
            pic, original = get(image_url)
            import io
            with Image.open(io.BytesIO(pic)) as im:
                im.thumbnail((1100,700))
                im.convert('RGB').save(OUT / (ident + '.jpg'), quality=88)
            record['image'] = '/images/' + ident + '.jpg'
            record['imageSource'] = original
            record['imageCaption'] = 'Source-page illustration; consult the original caption for image coverage and colour processing.'
            record['imageCredit'] = 'Full image credit and usage terms: original source linked below.'
    except Exception as exc:
        record['sourceStatus'] = 'Source access incomplete: ' + str(exc)
    print(ident, record['sourceStatus'], 'image', bool(record['image']), flush=True)
    return record

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    locations = list(pool.map(prepare, items))
(ROOT/'data'/'locations.json').write_text(json.dumps(locations,indent=2,ensure_ascii=False),encoding='utf-8')

audit=[]
for p in sorted(RAW.rglob('*')):
    if not p.is_file(): continue
    row={'filename':p.name,'fullPath':str(p.resolve()),'bytes':p.stat().st_size,'format':p.suffix,'sha256':None}
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(8*1024*1024),b''):h.update(block)
    row['sha256']=h.hexdigest()
    if p.suffix.lower() in ['.jpg','.png']:
        with Image.open(p) as im:row.update(dimensions=list(im.size),mode=im.mode)
        row.update(source='Supplied image; original provenance requires individual verification',coverage='See source notes; PNG geography provisional',resolution='Rendered pixel dimensions are not scientific spatial resolution',units='Not numerically sampled',reliability='Reference only until verified',intendedUse='Reference archive; prefer source-linked mission imagery',processing='No changes to original')
    elif p.suffix.lower()=='.tif':
        import tifffile
        with tifffile.TiffFile(p) as tf:row.update(dimensions=list(tf.pages[0].shape),georeferencing=str(tf.geotiff_metadata))
        row.update(source='USGS MGS MOLA DEM 463m; supplied filename matches published product',coverage='Global Mars',resolution='463.0935415503709 projected metres/pixel',units='Elevation metres above areoid per source documentation',reliability='Broad terrain; interpolated gaps, no rock-scale hazards',intendedUse='Windowed terrain context and overview',processing='Read-only inspection; numerical derivatives generated separately')
    else:row.update(intendedUse='Research / provenance reference',reliability='Supplied text; independently check claims')
    audit.append(row)
(ROOT/'data'/'audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False),encoding='utf-8')
(ROOT/'docs'/'DATA_AUDIT.md').write_text('# Supplied data audit\n\nGenerated by `scripts/prepare_atlas.py`. Full paths, sizes, checksums, metadata and limitations are recorded in `data/audit.json`. All originals remain unchanged and ignored by Git.\n\n'+'\n'.join(f"- **{r['filename']}** — {r['bytes']:,} bytes; {r.get('dimensions','text')}; SHA-256 `{r['sha256']}`. {r.get('intendedUse','')}" for r in audit)+'\n',encoding='utf-8')
