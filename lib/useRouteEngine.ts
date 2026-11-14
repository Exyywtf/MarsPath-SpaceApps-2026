'use client';
import { useEffect, useRef, useState } from 'react';
import { type PlannerDraft, type PlannerSettings, type PlannerResult } from './planner';
export function useRouteEngine(draft:PlannerDraft,settings:PlannerSettings,revision:number){
  const worker=useRef<Worker|null>(null),requestId=useRef(0);
  const key=JSON.stringify([draft,settings,revision]);const keyRef=useRef(key);
  const [state,setState]=useState<{key:string;result?:PlannerResult;error?:string}>({key:''});
  useEffect(()=>{const w=new Worker('/route-worker.js');worker.current=w;
    w.onmessage=(event:MessageEvent<{id:number;result?:PlannerResult;error?:string}>)=>{if(event.data.id===requestId.current)setState({key:keyRef.current,result:event.data.result,error:event.data.error});};
    w.onerror=()=>setState({key:keyRef.current,error:'The route worker failed. Reload the page to restart it.'});
    return()=>{w.terminate();worker.current=null;};
  },[]);
  useEffect(()=>{keyRef.current=key;const id=++requestId.current;worker.current?.postMessage({id,cancel:true});
    if(!draft.start||!draft.end)return;
    const timer=setTimeout(()=>worker.current?.postMessage({id,draft,settings}),150);return()=>clearTimeout(timer);
  },[key,draft,settings]);
  const complete=state.key===key;
  return {result:complete?state.result:undefined,error:complete?state.error:undefined,pending:!!draft.start&&!!draft.end&&!complete};
}
