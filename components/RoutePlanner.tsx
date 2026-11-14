'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, Download, RotateCcw, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import metadata from '@/public/processed/jezero.json';
import { coordinateLabel, type LonLat } from '@/lib/mars';
import type { RouteResult, TerrainMeta } from '@/lib/routing';
import type { MapRoute } from './MarsMap';
export const terrainMetadata:TerrainMeta=metadata;
interface Props {endpoints:LonLat[];onEndpoints:(points:LonLat[])=>void;onRoutes:(routes:MapRoute[])=>void;onClose:()=>void}
const colors=['#f4bd83','#92d9bd'];
const EMPTY_RESULTS:RouteResult[]=[];
export default function RoutePlanner({endpoints,onEndpoints,onRoutes,onClose}:Props){
  const [maxSlope,setMaxSlope]=useState(20);const [riskWeight,setRiskWeight]=useState(4);const [preference,setPreference]=useState(60);
  const [rawResults,setResults]=useState<RouteResult[]>(EMPTY_RESULTS);const [rawStatus,setStatus]=useState('Preparing terrain…');const [rawError,setError]=useState('');const [active,setActive]=useState(1);
  const [completedKey,setCompletedKey]=useState('');
  const requestKey=JSON.stringify([endpoints,maxSlope,riskWeight]);
  const results=completedKey===requestKey?rawResults:EMPTY_RESULTS;
  const error=completedKey===requestKey?rawError:'';
  const status=completedKey===requestKey?rawStatus:'Calculating on the 20 m terrain grid…';
  const [example,setExample]=useState(0);
  useEffect(()=>{
    if(endpoints.length!==2){onRoutes([]);return;}
    let alive=true;let worker:Worker|undefined;
    const timer=setTimeout(()=>{
      setStatus('Calculating on the 20 m terrain grid…');setResults(EMPTY_RESULTS);setError('');onRoutes([]);
      worker=new Worker('/route-worker.js');
      worker.onmessage=(event:MessageEvent<{routes?:RouteResult[];error?:string}>)=>{
        if(!alive)return;
        setCompletedKey(requestKey);
        if(event.data.error){setError(event.data.error);setStatus('No route calculated');}
        else {setResults(event.data.routes??[]);setStatus('Calculated from numerical terrain');}
      };
      worker.onerror=()=>{if(alive){setCompletedKey(requestKey);setError('The route worker failed. Retry or choose another endpoint pair.');setStatus('Calculation failed');}};
      worker.postMessage({meta:terrainMetadata,request:{endpoints,maxSlope,riskWeight}});
    },180);
    return ()=>{alive=false;clearTimeout(timer);worker?.terminate();};
  },[endpoints,maxSlope,riskWeight,onRoutes,requestKey]);
  useEffect(()=>{onRoutes(results.map((r,i)=>({coordinates:r.coordinates,color:colors[i],selected:i===active})));},[results,active,onRoutes]);
  const current=results[active];
  const shortest=results[0],lower=results[1];
  const maxDist=Math.max(...results.map(r=>r.distance),1),minDist=Math.min(...results.map(r=>r.distance));
  const maxRisk=Math.max(...results.map(r=>r.riskIntegral),0),minRisk=Math.min(...results.map(r=>r.riskIntegral));
  const scores=results.map(r=>(1-preference/100)*(maxDist>minDist?(r.distance-minDist)/(maxDist-minDist):0)+preference/100*(maxRisk>minRisk?(r.riskIntegral-minRisk)/(maxRisk-minRisk):0));
  const recommended=scores.length?scores.indexOf(Math.min(...scores)):0;
  const identical=!!shortest&&!!lower&&shortest.cells.length===lower.cells.length&&shortest.cells.every((v,i)=>v===lower.cells[i]);
  function nextExample(){const n=(example+1)%terrainMetadata.examples.length;setExample(n);onEndpoints(terrainMetadata.examples[n] as LonLat[]);}
  function exportRoute(){if(!current)return;const blob=new Blob([JSON.stringify({type:'Feature',geometry:{type:'LineString',coordinates:current.coordinates},properties:{body:'Mars',latitudeType:'planetocentric',longitude:'east-positive',sphereRadiusM:metadata.radius,region:metadata.id,terrainSha256:metadata.sha256,route:current.name,distanceM:current.distance,ascentM:current.ascent,descentM:current.descent,maxSlopeDegrees:current.maxSlope,slopeConstraintDegrees:maxSlope,lambda:current.lambda,source:metadata.sourcePage,warning:'Research-grade model; not operational astronaut navigation'}},null,2)],{type:'application/geo+json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='marspath-jezero-route.geojson';a.click();URL.revokeObjectURL(url);}
  return <aside className="detail-panel planner-panel"><div className="detail-top"><span className="eyebrow">MISSION PLANNING / JEZERO</span><button className="icon-button" aria-label="Close route planner" onClick={onClose}><X size={18}/></button></div><div className="detail-body"><span className="eyebrow orange">REAL TERRAIN. EXPLICIT ASSUMPTIONS.</span><h2>Choose your traverse.</h2><p className="planner-intro">Place A and B inside the green coverage, or drag either marker. After placing two endpoints, another map click starts a new pair.</p><div className="endpoint-row"><span>A</span><code>{endpoints[0]?coordinateLabel(endpoints[0]):'Click a start on the map'}</code></div><div className="endpoint-row end"><span>B</span><code>{endpoints[1]?coordinateLabel(endpoints[1]):'Click a destination'}</code></div><button className="text-link example-button" onClick={nextExample}><RotateCcw size={13}/>Try terrain example {example+1} / 3</button><p className="small-note">Example coordinates are terrain samples, not named science targets or recorded rover paths.</p><label className="slider-label">Maximum modelled slope <span>{maxSlope}°</span><input aria-label="Maximum modelled slope" type="range" min="5" max="30" step="1" value={maxSlope} onChange={e=>setMaxSlope(+e.target.value)}/></label><label className="slider-label">Terrain penalty strength (λ) <span>{riskWeight}</span><input aria-label="Terrain penalty strength" type="range" min="1" max="10" step="1" value={riskWeight} onChange={e=>setRiskWeight(+e.target.value)}/></label><p className="small-note">Slope limits are user-adjustable model assumptions, not NASA safety standards.</p><div className="route-status" role="status"><span className="status-dot"/>{endpoints.length===2?status:'Choose two points to calculate'}<small>USGS CTX DTM · 20 m grid</small></div>{error&&<div role="alert" className="route-error">{error}</div>}
      {results.length>0&&<><div className="route-options">{results.map((r,i)=><button key={r.id} className={`route-option ${active===i?'selected':''}`} onClick={()=>setActive(i)}><span className="route-color" style={{background:colors[i]}}/><strong>{r.name}</strong><span>{(r.distance/1000).toFixed(2)} km</span>{recommended===i&&<small>Recommended</small>}</button>)}</div><label className="slider-label recommendation-slider">Recommendation preference <span>{preference}% terrain</span><input aria-label="Recommendation terrain preference" type="range" min="0" max="100" step="5" value={preference} onChange={e=>{setPreference(+e.target.value);}}/></label><p className="small-note">Compares normalized distance and integrated terrain penalty of these two candidates. Science value is not scored.</p>{current&&<><div className="route-metrics"><div><span>ASCENT</span><strong>{current.ascent.toFixed(0)}<small> m</small></strong></div><div><span>DESCENT</span><strong>{current.descent.toFixed(0)}<small> m</small></strong></div><div><span>MAX SLOPE</span><strong>{current.maxSlope.toFixed(1)}<small>°</small></strong></div><div><span>MEAN SLOPE</span><strong>{current.meanSlope.toFixed(1)}<small>°</small></strong></div></div><span className="eyebrow">ELEVATION / METRES ABOVE DATUM</span><div className="profile-chart" aria-label="Route elevation profile"><ResponsiveContainer width="100%" height={150}><LineChart data={current.profile.filter((_,i)=>i%Math.max(1,Math.ceil(current.profile.length/200))===0||i===current.profile.length-1)} margin={{top:15,right:5,left:-20,bottom:0}}><XAxis dataKey="distance" type="number" domain={['dataMin','dataMax']} tickFormatter={n=>`${(n/1000).toFixed(1)} km`} tick={{fontSize:9,fill:'#8f9b9f'}} axisLine={false} tickLine={false}/><YAxis domain={['dataMin - 5','dataMax + 5']} tick={{fontSize:9,fill:'#8f9b9f'}} axisLine={false} tickLine={false}/><Tooltip formatter={v=>[`${Number(v).toFixed(1)} m`,'Elevation']} labelFormatter={v=>`${(Number(v)/1000).toFixed(2)} km`} contentStyle={{background:'#192127',border:'1px solid #46534f',fontSize:11}}/><Line dataKey="elevation" type="linear" stroke={colors[active]} strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div><details className="route-explanation" open><summary>Why this route? <ChevronDown size={14}/></summary><p>{identical?'Both cost models produced the same path at this terrain resolution. There is no invented alternative.':`${lower.name} is ${Math.abs(lower.distance-shortest.distance).toFixed(0)} m ${lower.distance>=shortest.distance?'longer':'shorter'} than the shortest feasible route, with ${shortest.riskIntegral>0?((1-lower.riskIntegral/shortest.riskIntegral)*100).toFixed(1):'0.0'}% lower integrated terrain penalty.`}</p><p>{results[recommended].name} is recommended at your {preference}% terrain / {100-preference}% distance preference. {current.name} climbs {current.ascent.toFixed(0)} m and reaches {current.maxSlope.toFixed(1)}° maximum modelled slope.</p><p>Endpoints snap to terrain-cell centres by {current.snapping.map(n=>`${n.toFixed(1)} m`).join(' and ')}. Missing terrain is blocked. Climate, radiation and rock-scale obstacles are not scored.</p></details><button className="export-route" onClick={exportRoute}><Download size={14}/>Export route & provenance</button></> }</>}
      <div className="data-note"><strong>Research-grade regional planning</strong><p>20 m elevation cells cannot resolve individual rocks. Lower modelled terrain penalty is not a guarantee of safety.</p></div><Link className="text-link" href="/methodology/">Algorithm, weights & limitations <ArrowUpRight size={13}/></Link><a className="source-link" href={metadata.sourcePage} target="_blank" rel="noreferrer">Original terrain product <ArrowUpRight size={13}/></a></div></aside>;
}
