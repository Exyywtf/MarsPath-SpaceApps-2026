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
import MultiLineString from 'ol/geom/MultiLineString';
import Polygon from 'ol/geom/Polygon';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import Translate from 'ol/interaction/Translate';
import { locations, asLonLat } from '@/lib/atlas';
import services from '@/data/services.json';
import { coordinateLabel, MARS_RADIUS, normalizeLon, marsDistance, type LonLat } from '@/lib/mars';
import { splitDateLine, type Placement, type PlannerDraft } from '@/lib/planner';

export interface MapHandle {focus:(point:LonLat,zoom?:number)=>void;reset:()=>void;zoomBy:(delta:number)=>void;centre:()=>LonLat|null;fitRoute:(points:LonLat[])=>void}
export interface MapRoute {coordinates:LonLat[];color:string;selected:boolean;connectors?:LonLat[][]}
interface Props {
  selected:string|null;basemap:string;topography:boolean;opacity:number;showLocations:boolean;
  onSelect:(id:string)=>void;onCoordinate:(label:string)=>void;onImagery:(label:string)=>void;
  onTileState:(ok:boolean)=>void;onScale:(scale:string)=>void;draft:PlannerDraft;placement:Placement;
  onPlace:(point:LonLat)=>void;onMovePoint:(kind:'start'|'end'|number,point:LonLat)=>void;
  routes:MapRoute[];terrainBounds:number[];padding:number[];profilePoint?:LonLat|null;
  onInspect?:(point:LonLat)=>void;
}
const MarsMap=forwardRef<MapHandle,Props>(function MarsMap(props,ref){
  const host=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),handlers=useRef(props),syncMetadata=useRef<()=>void>(()=>{});
  const bases=useRef<TileLayer<WMTS>[]>([]),markers=useRef<VectorLayer<VectorSource>|null>(null);
  const routeSource=useRef(new VectorSource()),endpointSource=useRef(new VectorSource()),boundsSource=useRef(new VectorSource()),profileSource=useRef(new VectorSource());
  useEffect(()=>{handlers.current=props;});
  function duration(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:220;}
  useImperativeHandle(ref,()=>({
    focus:(point,zoom=6)=>{const v=map.current?.getView();v?.cancelAnimations();v?.animate({center:point,zoom,duration:duration()});},
    reset:()=>{const v=map.current?.getView();v?.cancelAnimations();v?.fit([-180,-90,180,90],{padding:[24,24,24,24],duration:duration()});},
    zoomBy:(delta)=>{const v=map.current?.getView();v?.cancelAnimations();if(v)v.animate({zoom:(v.getZoom()??1)+delta,duration:duration()});},
    centre:()=>{const p=map.current?.getView().getCenter();return p?[normalizeLon(p[0]),Math.max(-90,Math.min(90,p[1]))]:null;},
    fitRoute:(points)=>{if(!points.length)return;const v=map.current?.getView();v?.cancelAnimations();v?.fit(new MultiLineString(splitDateLine(points)),{maxZoom:14,padding:[60,60,60,60],duration:duration()});},
  }),[]);
  useEffect(()=>{
    if(!host.current)return;
    const projection=new Projection({code:'MARSPATH:2000',units:'degrees',extent:[-180,-90,180,90],worldExtent:[-180,-90,180,90],global:true,metersPerUnit:MARS_RADIUS*Math.PI/180,getPointResolution:(resolution,point)=>resolution*Math.cos(point[1]*Math.PI/180)});
    addProjection(projection);
    let failures=0;
    const tiles=services.map((service,i)=>{
      const source=new WMTS({url:service.url,layer:service.id,matrixSet:service.matrixSet,format:service.format,style:service.style,requestEncoding:'REST',projection,tileGrid:new WMTSTileGrid({extent:[-180,-90,180,90],origin:service.origin,resolutions:service.resolutions,matrixIds:service.matrixIds,sizes:service.sizes,tileSize:service.tileSize}),wrapX:true,crossOrigin:'anonymous',attributions:'NASA / JPL / USGS · Mars Trek'});
      source.on('tileloadend',()=>{if(!failures)handlers.current.onTileState(true);});
      source.on('tileloaderror',()=>{failures++;handlers.current.onTileState(false);});
      return new TileLayer({source,visible:i===0||i>=2,minZoom:i===2?8:i===3?12:undefined,extent:i>=2?service.bounds:undefined});
    });bases.current=tiles;
    const markerStyles=new globalThis.Map<string,Style>();
    const markerSource=new VectorSource({features:locations.map(l=>new Feature({geometry:new Point(asLonLat(l.coordinates)),locationId:l.id,name:l.name})),wrapX:true});
    const markerLayer=new VectorLayer({source:markerSource,declutter:true,style:f=>{
      const active=f.get('locationId')===handlers.current.selected,key=String(f.get('locationId'))+active;
      if(!markerStyles.has(key))markerStyles.set(key,new Style({image:new Circle({radius:active?8:6,fill:new Fill({color:active?'#ffd2a9':'#edaa79'}),stroke:new Stroke({color:'#171b1e',width:2})}),text:new Text({text:String(f.get('name')),offsetY:-20,font:(active?'600':'500')+' 13px sans-serif',fill:new Fill({color:'#fff7ed'}),stroke:new Stroke({color:'#171b1e',width:4})})}));
      return markerStyles.get(key);
    }});markers.current=markerLayer;
    const boundsLayer=new VectorLayer({source:boundsSource.current,style:new Style({stroke:new Stroke({color:'#94d2b8',width:1.5,lineDash:[7,5]}),fill:new Fill({color:'#94d2b808'})})});
    const routeStyles=new globalThis.Map<string,Style[]>();
    const routeLayer=new VectorLayer({source:routeSource.current,style:f=>{
      const color=String(f.get('color')),selected=!!f.get('selected'),connector=!!f.get('connector'),key=color+selected+connector;
      if(!routeStyles.has(key))routeStyles.set(key,[new Style({stroke:new Stroke({color:'#121b1d',width:selected?8:6})}),new Style({stroke:new Stroke({color,width:connector?2:selected?4:3,lineDash:connector?[2,6]:selected?undefined:[9,7]})})]);return routeStyles.get(key);
    }});
    const endpointStyles=new globalThis.Map<string,Style>();
    const endpointLayer=new VectorLayer({source:endpointSource.current,style:f=>{
      const label=String(f.get('label'));
      if(!endpointStyles.has(label))endpointStyles.set(label,new Style({image:new Circle({radius:13,fill:new Fill({color:label==='A'?'#a3e0c6':label==='B'?'#f8c087':'#e5e9e6'}),stroke:new Stroke({color:'#142421',width:3})}),text:new Text({text:label,font:'bold 12px sans-serif',fill:new Fill({color:'#142421'})})}));return endpointStyles.get(label);
    }});
    const profileLayer=new VectorLayer({source:profileSource.current,style:new Style({image:new Circle({radius:7,fill:new Fill({color:'#fff8ed'}),stroke:new Stroke({color:'#132d28',width:3})})})});
    const instance=new Map({target:host.current,layers:[...tiles,boundsLayer,markerLayer,routeLayer,endpointLayer,profileLayer],view:new View({projection,center:[0,0],zoom:1,minZoom:0,maxZoom:17,constrainOnlyCenter:true,showFullExtent:true,padding:handlers.current.padding}),controls:defaultControls({zoom:false,rotate:false,attribution:false})});
    map.current=instance;instance.getView().fit([-180,-90,180,90],{padding:[24,24,24,24]});
    const translate=new Translate({layers:[endpointLayer]});instance.addInteraction(translate);
    translate.on('translateend',e=>{e.features.forEach(f=>{const p=(f.getGeometry() as Point).getCoordinates();handlers.current.onMovePoint(f.get('kind'),[normalizeLon(p[0]),Math.max(-90,Math.min(90,p[1]))]);});});
    instance.on('singleclick',e=>{
      if(Math.abs(e.coordinate[1])>90)return;
      const point:LonLat=[normalizeLon(e.coordinate[0]),e.coordinate[1]];
      if(handlers.current.placement)handlers.current.onPlace(point);
      else {const hit=instance.forEachFeatureAtPixel(e.pixel,f=>f.get('locationId') as string|undefined,{hitTolerance:10});if(hit)handlers.current.onSelect(hit);else handlers.current.onInspect?.(point);}
    });
    let lastPointer=0;
    instance.on('pointermove',e=>{if(Date.now()-lastPointer>=100){lastPointer=Date.now();handlers.current.onCoordinate(Math.abs(e.coordinate[1])<=90?coordinateLabel([e.coordinate[0],e.coordinate[1]]):'Outside Mars extent');}});
    const syncView=()=>{
      const v=instance.getView(),c=v.getCenter()!,z=v.getZoom()??0;
      // View metadata changes only on completed moves; no JSON work each frame.
      if(host.current){host.current.dataset.center=JSON.stringify(c);host.current.dataset.resolution=String(v.getResolution());host.current.dataset.animating='false';const a=handlers.current.draft.start;if(a)host.current.dataset.startPixel=JSON.stringify(instance.getPixelFromCoordinate(a));}
      const distance=marsDistance([c[0],c[1]],[c[0]+(v.getResolution()??1)*100,c[1]]);
      handlers.current.onScale(distance>=1000?(distance/1000).toFixed(1)+' km':distance.toFixed(0)+' m');
      const hirise=z>12&&c[0]>=77.2229331&&c[0]<=77.583964&&c[1]>=18.3067994&&c[1]<=18.669315;
      const ctx=z>8&&c[0]>=77.1604655&&c[0]<=77.6991776&&c[1]>=18.2110274&&c[1]<=18.7211945;
      handlers.current.onImagery(hirise?'HiRISE · 0.25 m imagery':ctx?'CTX · 6 m imagery':handlers.current.basemap==='relief'?'MOLA · 463 m relief':'Viking · 232 m mosaic');
    };
    instance.on('movestart',()=>{if(host.current)host.current.dataset.animating='true';});
    syncMetadata.current=syncView;
    instance.on('moveend',syncView);
    const initialFit=requestAnimationFrame(()=>instance.getView().fit([-180,-90,180,90],{padding:[24,24,24,24]}));
    const observer=new ResizeObserver(()=>{instance.updateSize();instance.once('postrender',syncView);instance.render();});observer.observe(host.current);
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop=()=>{if(motion.matches)instance.getView().cancelAnimations();};motion.addEventListener('change',stop);
    return()=>{cancelAnimationFrame(initialFit);observer.disconnect();motion.removeEventListener('change',stop);instance.setTarget(undefined);map.current=null;};
  },[]);
  useEffect(()=>{const b=bases.current;if(!b.length)return;b[0].setVisible(props.basemap==='optical');b[1].setVisible(props.basemap==='relief'||props.topography);b[1].setOpacity(props.basemap==='relief'?1:props.opacity);b[2].setVisible(props.basemap==='optical');b[3].setVisible(props.basemap==='optical');markers.current?.setVisible(props.showLocations);markers.current?.changed();},[props.basemap,props.topography,props.opacity,props.showLocations,props.selected]);
  useEffect(()=>{routeSource.current.clear();for(const r of props.routes){routeSource.current.addFeature(new Feature({geometry:new MultiLineString(splitDateLine(r.coordinates)),color:r.color,selected:r.selected}));if(r.selected)for(const c of r.connectors??[])routeSource.current.addFeature(new Feature({geometry:new MultiLineString(splitDateLine(c)),color:r.color,selected:false,connector:true}));}},[props.routes]);
  useEffect(()=>{
    endpointSource.current.clear();const {start,end,waypoints}=props.draft;
    for(const [p,kind,label] of [[start,'start','A'],[end,'end','B'],...waypoints.map((p,i)=>[p,i,String(i+1)])] as [LonLat|null,'start'|'end'|number,string][]){if(p)endpointSource.current.addFeature(new Feature({geometry:new Point(p),kind,label}));}
    if(map.current){map.current.once('postrender',syncMetadata.current);map.current.render();}
  },[props.draft]);
  useEffect(()=>{if(map.current){const v=map.current.getView(),centre=v.getCenter()?.slice();v.cancelAnimations();v.padding=props.padding;if(centre)v.setCenter(centre);map.current.once('postrender',syncMetadata.current);map.current.render();}},[props.padding]);
  useEffect(()=>{boundsSource.current.clear();const [w,s,e,n]=props.terrainBounds;boundsSource.current.addFeature(new Feature(new Polygon([[[w,s],[e,s],[e,n],[w,n],[w,s]]])));},[props.terrainBounds]);
  useEffect(()=>{profileSource.current.clear();if(props.profilePoint)profileSource.current.addFeature(new Feature(new Point(props.profilePoint)));},[props.profilePoint]);
  return <div ref={host} className={'map-canvas'+(props.placement?' placing':'')} role="region" aria-label="Interactive Mars map" aria-describedby={props.placement?'placement-instruction':undefined} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'&&handlers.current.placement){e.preventDefault();const p=map.current?.getView().getCenter();if(p)handlers.current.onPlace([normalizeLon(p[0]),Math.max(-90,Math.min(90,p[1]))]);}}}/>;
});
export default MarsMap;
