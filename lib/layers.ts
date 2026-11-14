import records from '../data/layers.json';
import { normalizeLon, type LonLat } from './mars';
export type LayerId='topography'|'temperature'|'pressure'|'wind';
export interface LayerDataset {id:LayerId;name:string;unit:string;range:number[];palette:string[];imageUrl:string;imageSize:number[];bounds:number[];sampling:string;nativeResolution:string;kind:string;sourcePage:string;dataUrl:string;sha256:string;processedAt:string;context:string;terms:string}
export interface ClimateData {width:number;height:number;fields:Record<string,{values:number[];range:number[];seamMaxDifference:number}>;sha256:string;providerGeneratedAt:string}
export const scientificLayers=records as LayerDataset[];
// Both image generation and inspection use the same numerical linear sampling.
export function sampleGrid(values:ArrayLike<number>,width:number,height:number,p:LonLat,nodeGrid:boolean):number|null{
  if(!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[1])>90)return null;
  let x=(normalizeLon(p[0])+180)/360*(nodeGrid?width-1:width)-(nodeGrid?0:.5);
  let y=(90-p[1])/180*(nodeGrid?height-1:height)-(nodeGrid?0:.5);
  y=Math.max(0,Math.min(height-1,y));if(nodeGrid)x=Math.max(0,Math.min(width-1,x));
  const base=Math.floor(x),x0=(base%width+width)%width,x1=nodeGrid?Math.min(width-1,x0+1):(x0+1)%width,y0=Math.floor(y),y1=Math.min(height-1,y0+1),fx=x-base,fy=y-y0;
  const a=values[y0*width+x0],b=values[y0*width+x1],c=values[y1*width+x0],d=values[y1*width+x1];
  if(![a,b,c,d].every(Number.isFinite))return null;return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}
export function layerValue(value:number,id:LayerId){return value.toLocaleString(undefined,{maximumFractionDigits:id==='wind'?2:id==='topography'?0:1});}
