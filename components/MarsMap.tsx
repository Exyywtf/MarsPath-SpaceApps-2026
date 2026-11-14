'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import Projection from 'ol/proj/Projection';
import { addProjection } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import Translate from 'ol/interaction/Translate';
import { locations, asLonLat } from '@/lib/atlas';
import services from '@/data/services.json';
import { coordinateLabel, MARS_RADIUS, normalizeLon, marsDistance, type LonLat } from '@/lib/mars';

export interface MapHandle { focus: (point: LonLat, zoom?: number) => void; reset: () => void; zoomBy: (delta: number) => void }
export interface MapRoute { coordinates: LonLat[]; color: string; selected: boolean }
interface Props {
  selected: string | null; basemap: string; topography: boolean; opacity: number; showLocations: boolean;
  onSelect: (id: string) => void; onCoordinate: (label: string) => void; onImagery: (label: string) => void;
  onTileState: (ok: boolean) => void; onScale: (scale: string) => void; planner?: boolean; endpoints?: LonLat[];
  onEndpoints?: (points: LonLat[]) => void; routes?: MapRoute[]; terrainBounds?: number[];
}
const MarsMap = forwardRef<MapHandle, Props>(function MarsMap(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const bases = useRef<TileLayer<WMTS>[]>([]);
  const markers = useRef<VectorLayer<VectorSource> | null>(null);
  const routeSource = useRef(new VectorSource());
  const endpointSource = useRef(new VectorSource());
  const boundsSource = useRef(new VectorSource());
  const handlers = useRef(props);
  useEffect(() => { handlers.current = props; });
  useImperativeHandle(ref, () => ({
    focus: (point, zoom = 6) => map.current?.getView().animate({ center: point, zoom, duration: 650 }),
    reset: () => map.current?.getView().fit([-180,-90,180,90], {padding:[30,30,30,30],duration:650}),
    zoomBy: (delta) => {const v=map.current?.getView();if(v)v.animate({zoom:(v.getZoom()??1)+delta,duration:200});},
  }), []);
  useEffect(() => {
    if (!host.current) return;
    const projection = new Projection({code:'MARSPATH:2000',units:'degrees',extent:[-180,-90,180,90],worldExtent:[-180,-90,180,90],global:true,metersPerUnit:MARS_RADIUS*Math.PI/180,
      getPointResolution:(resolution,point) => resolution * Math.cos(point[1]*Math.PI/180),
    });
    addProjection(projection);
    const tiles = services.map((service,i) => {
      const source = new WMTS({url:service.url,layer:service.id,matrixSet:service.matrixSet,format:service.format,style:service.style,requestEncoding:'REST',projection,
        tileGrid:new WMTSTileGrid({extent:[-180,-90,180,90],origin:service.origin,resolutions:service.resolutions,matrixIds:service.matrixIds,sizes:service.sizes,tileSize:service.tileSize}),wrapX:true,crossOrigin:'anonymous',attributions:'NASA / JPL / USGS • Mars Trek',
      });
      source.on('tileloadend',()=>handlers.current.onTileState(true));
      source.on('tileloaderror',()=>handlers.current.onTileState(false));
      return new TileLayer({source,visible:i===0 || i>=2,minZoom:i===2?8:i===3?12:undefined,extent:i>=2?service.bounds:undefined});
    });
    bases.current = tiles;
    const markerSource = new VectorSource({features:locations.map(l=>new Feature({geometry:new Point(asLonLat(l.coordinates)),locationId:l.id,name:l.name})),wrapX:true});
    const markerLayer = new VectorLayer({source:markerSource,style:feature => {
      const active=feature.get('locationId')===handlers.current.selected;
      return new Style({image:new Circle({radius:active?7:4.5,fill:new Fill({color:active?'#f9ad75':'#ed8c54'}),stroke:new Stroke({color:'#181a1d',width:2})}),text:new Text({text:String(feature.get('name')),offsetY:-17,font:`${active?'600':'400'} 11px sans-serif`,fill:new Fill({color:'#fff3e7'}),stroke:new Stroke({color:'#17191de8',width:3})})});
    }});
    markers.current=markerLayer;
    const boundsLayer=new VectorLayer({source:boundsSource.current,style:new Style({stroke:new Stroke({color:'#88cbb5',width:1.5,lineDash:[7,5]}),fill:new Fill({color:'#88cbb509'})})});
    const routeLayer=new VectorLayer({source:routeSource.current,style:f=>new Style({stroke:new Stroke({color:String(f.get('color')),width:f.get('selected')?4:2.5,lineDash:f.get('selected')?undefined:[5,6]})})});
    const endpointLayer=new VectorLayer({source:endpointSource.current,style:f=>new Style({image:new Circle({radius:9,fill:new Fill({color:f.get('index')===0?'#99d6be':'#f5b076'}),stroke:new Stroke({color:'#10211d',width:3})}),text:new Text({text:f.get('index')===0?'A':'B',font:'bold 10px sans-serif',fill:new Fill({color:'#142019'})})})});
    const instance=new Map({target:host.current,layers:[...tiles,boundsLayer,markerLayer,routeLayer,endpointLayer],view:new View({projection,center:[0,0],zoom:1,minZoom:0,maxZoom:17,constrainOnlyCenter:true,showFullExtent:true}),controls:defaultControls({zoom:false,rotate:false,attribution:false})});
    map.current=instance;
    instance.getView().fit([-180,-90,180,90],{padding:[20,20,20,20]});
    const translate=new Translate({layers:[endpointLayer]});
    instance.addInteraction(translate);
    translate.on('translateend',()=>{
      const points=endpointSource.current.getFeatures().sort((a,b)=>a.get('index')-b.get('index')).map(f=>(f.getGeometry() as Point).getCoordinates() as LonLat);
      handlers.current.onEndpoints?.(points);
    });
    instance.on('singleclick',e=>{
      const hit=instance.forEachFeatureAtPixel(e.pixel,f=>f.get('locationId') as string | undefined,{hitTolerance:8});
      if (handlers.current.planner) {
        const c:LonLat=[normalizeLon(e.coordinate[0]),e.coordinate[1]];
        const old=handlers.current.endpoints ?? [];
        handlers.current.onEndpoints?.(old.length>=2?[c]:[...old,c]);
      } else if(hit) handlers.current.onSelect(hit);
    });
    let lastPointer=0;
    instance.on('pointermove',e=>{if(Date.now()-lastPointer>80){lastPointer=Date.now();handlers.current.onCoordinate(Math.abs(e.coordinate[1])<=90?coordinateLabel([e.coordinate[0],e.coordinate[1]]):'Outside Mars map extent');}});
    instance.on('postrender',()=>{
      const start=handlers.current.endpoints?.[0];
      if(start&&host.current)host.current.dataset.startPixel=JSON.stringify(instance.getPixelFromCoordinate(start));
      const c=instance.getView().getCenter();
      if(c&&host.current)host.current.dataset.center=JSON.stringify(c);
      if(host.current)host.current.dataset.resolution=String(instance.getView().getResolution());
      if(host.current)host.current.dataset.animating=String(instance.getView().getAnimating());
    });
    instance.on('moveend',()=>{
      const v=instance.getView(), c=v.getCenter()!;
      const z=v.getZoom()??0;
      const distance=marsDistance([c[0],c[1]],[c[0]+(v.getResolution()??1)*100,c[1]]);
      handlers.current.onScale(distance>=1000?`${(distance/1000).toFixed(1)} km`:`${distance.toFixed(0)} m`);
      const hirise=z>12 && c[0]>=77.2229331 && c[0]<=77.583964 && c[1]>=18.3067994 && c[1]<=18.669315;
      const ctx=z>8 && c[0]>=77.1604655 && c[0]<=77.6991776 && c[1]>=18.2110274 && c[1]<=18.7211945;
      handlers.current.onImagery(hirise?'HiRISE · 0.25 m imagery':ctx?'CTX · 6 m imagery':handlers.current.basemap==='relief'?'MOLA · 463 m relief':'Viking · 232 m mosaic');
    });
    const observer=new ResizeObserver(()=>instance.updateSize());observer.observe(host.current);
    return ()=>{observer.disconnect();instance.setTarget(undefined);map.current=null;};
  }, []);
  useEffect(()=>{
    const b=bases.current;if(!b.length)return;
    const z=map.current?.getView().getZoom()??0;if(z<8)handlers.current.onImagery(props.basemap==='relief'?'MOLA · 463 m relief':'Viking · 232 m mosaic');
    b[0].setVisible(props.basemap==='optical');b[1].setVisible(props.basemap==='relief'||props.topography);
    b[1].setOpacity(props.basemap==='relief'?1:props.opacity);
    b[2].setVisible(props.basemap==='optical');b[3].setVisible(props.basemap==='optical');
    markers.current?.setVisible(props.showLocations);markers.current?.changed();
  },[props.basemap,props.topography,props.opacity,props.showLocations,props.selected]);
  useEffect(()=>{
    routeSource.current.clear();
    for(const r of props.routes??[])routeSource.current.addFeature(new Feature({geometry:new LineString(r.coordinates),color:r.color,selected:r.selected}));
  },[props.routes]);
  useEffect(()=>{
    endpointSource.current.clear();
    if(props.planner)(props.endpoints??[]).forEach((p,i)=>endpointSource.current.addFeature(new Feature({geometry:new Point(p),index:i})));
  },[props.endpoints,props.planner]);
  useEffect(()=>{
    const instance=map.current;
    if(!instance)return;
    instance.getView().padding=props.planner&&window.innerWidth<760?[0,0,(instance.getSize()?.[1]??0)*.58,0]:[0,0,0,0];
    if(props.planner)instance.getView().animate({center:[77.44,18.46],zoom:11,duration:650});
  },[props.planner]);
  useEffect(()=>{
    boundsSource.current.clear();
    if(props.planner&&props.terrainBounds){const [w,s,e,n]=props.terrainBounds;boundsSource.current.addFeature(new Feature(new Polygon([[[w,s],[e,s],[e,n],[w,n],[w,s]]])));}
  },[props.planner,props.terrainBounds]);
  return <div ref={host} className="map-canvas" role="region" aria-label="Interactive Mars map" tabIndex={0}/>;
});
export default MarsMap;
