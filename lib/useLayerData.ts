'use client';
import { useEffect, useState } from 'react';
import { sampleGrid, type ClimateData, type LayerDataset } from './layers';
import type { LonLat } from './mars';
type Grid={values:ArrayLike<number>;width:number;height:number;nodes:boolean};
const grids=new Map<string,Promise<Grid>>();
let climate:Promise<ClimateData>|undefined;
function load(layer:LayerDataset):Promise<Grid>{
  if(grids.has(layer.id))return grids.get(layer.id)!;
  const pending=layer.id==='topography'?fetch(layer.dataUrl).then(async r=>{if(!r.ok)throw new Error('Elevation download failed.');return {values:new Float32Array(await r.arrayBuffer()),width:1440,height:720,nodes:false};}):(()=>{
    climate??=fetch(layer.dataUrl).then(r=>{if(!r.ok)throw new Error('Climate download failed.');return r.json() as Promise<ClimateData>;}).catch(error=>{climate=undefined;throw error;});
    return climate.then(data=>({values:data.fields[layer.id].values,width:data.width,height:data.height,nodes:true}));
  })();grids.set(layer.id,pending);pending.catch(()=>grids.delete(layer.id));return pending;
}
export function useLayerData(layer:LayerDataset|null,point:LonLat|null){
  const [state,setState]=useState<{id:string;grid?:Grid;error?:string}>();
  useEffect(()=>{if(!layer)return;let alive=true;load(layer).then(grid=>{if(alive)setState({id:layer.id,grid});}).catch(error=>{if(alive)setState({id:layer.id,error:String(error)});});return()=>{alive=false;};},[layer]);
  const grid=state?.id===layer?.id?state?.grid:undefined;
  const error=layer&&state?.id===layer.id?state?.error:undefined;
  return {loading:!!layer&&!grid&&!error,error,value:grid&&point?sampleGrid(grid.values,grid.width,grid.height,point,grid.nodes):null};
}
