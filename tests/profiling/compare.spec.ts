import { test,expect,type Page } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import os from 'node:os';
type FrameState={active:boolean;last:number;frames:number[];longTasks:number[]};
declare global {interface Window {__marsFrames:FrameState}}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]??0;};
const percentile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]??0;
test('repeatable V1 versus V2 cached-imagery main-thread profile and screenshots',async({browser})=>{
  mkdirSync('tmp/v2-review',{recursive:true});
  const tileCache=new Map<string,{status:number;headers:Record<string,string>;body:Buffer}>();
  const liveNetwork:{url:string;ms:number;status:number}[]=[];
  const versions=[];
  for(const [version,url] of [['before','http://127.0.0.1:4318'],['after','http://127.0.0.1:3000']] as const){
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
    let terrainRequests=0,liveFetches=0,workerCreations=0;
    page.on('worker',()=>workerCreations++);page.on('request',r=>{if(/jezero-(elevation|slope|valid)\.(f32|u8)$/.test(r.url()))terrainRequests++;});
    await page.route('https://trek.nasa.gov/tiles/Mars/**',async route=>{
      const key=route.request().url();let cached=tileCache.get(key);
      if(!cached){const start=Date.now(),response=await route.fetch();const headers=response.headers();delete headers['content-encoding'];delete headers['content-length'];cached={status:response.status(),headers,body:await response.body()};liveNetwork.push({url:key,ms:Date.now()-start,status:cached.status});liveFetches++;if(cached.status===200)tileCache.set(key,cached);}
      await route.fulfill(cached);
    });
    await page.addInitScript(()=>{
      window.__marsFrames={active:false,last:0,frames:[],longTasks:[]};
      const frame=(t:number)=>{const s=window.__marsFrames;if(s.active){if(s.last)s.frames.push(t-s.last);s.last=t;}requestAnimationFrame(frame);};requestAnimationFrame(frame);
      new PerformanceObserver(list=>{if(window.__marsFrames.active)window.__marsFrames.longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask'});
    });
    for(const [width,height] of [[1920,1080],[1440,900],[1024,768],[390,844]]){
      await page.setViewportSize({width,height});const tile=page.waitForResponse(r=>r.url().includes('trek.nasa.gov/tiles/Mars/')&&r.status()===200);await page.goto(url);await tile;await page.waitForLoadState('networkidle');
      const dismiss=page.getByRole('button',{name:'Dismiss getting started'});if(await dismiss.count())await dismiss.click();
      await expect(page.locator('.destination')).toHaveCount(13);
      await page.screenshot({path:'tmp/v2-review/'+version+'-'+width+'x'+height+'.png'});
    }
    await page.setViewportSize({width:1440,height:900});await page.goto(url);
    if(version==='before')await page.getByRole('button',{name:'Mission planning',exact:true}).click();
    else{await page.getByRole('button',{name:'Directions',exact:true}).click();await page.getByRole('button',{name:'Try Jezero terrain example'}).click();}
    const count=version==='before'?2:3;await expect(page.locator('.route-option')).toHaveCount(count,{timeout:45000});
    await expect(page.getByRole('region',{name:'Interactive Mars map'})).toHaveAttribute('data-animating','false');
    // Warm and restore this exact drag path before taking any measurements.
    const drag=async(p:Page)=>{await p.mouse.move(950,330);await p.mouse.down();for(let i=1;i<=24;i++){await p.mouse.move(950+i*2,330+i/3);await p.waitForTimeout(16);}await p.mouse.up();await p.mouse.move(998,338);await p.mouse.down();for(let i=1;i<=24;i++){await p.mouse.move(998-i*2,338-i/3);await p.waitForTimeout(16);}await p.mouse.up();};
    await drag(page);
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const metrics=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');return Object.fromEntries(metrics.map((m:{name:string;value:number})=>[m.name,m.value]));};
    const runs=[];
    for(let run=0;run<3;run++){
      const before=await metrics(),fetches=liveFetches;
      await page.evaluate(()=>{window.__marsFrames={active:true,last:0,frames:[],longTasks:[]};});
      for(let i=0;i<90;i++){await page.mouse.move(950+Math.sin(i/10)*70,350+Math.cos(i/12)*35);await page.waitForTimeout(16);}
      await drag(page);
      const frames=await page.evaluate(()=>{window.__marsFrames.active=false;return window.__marsFrames;}),after=await metrics();
      runs.push({frameCount:frames.frames.length,medianFrameMs:median(frames.frames),p95FrameMs:percentile(frames.frames,.95),meanFrameMs:frames.frames.reduce((a,b)=>a+b,0)/Math.max(1,frames.frames.length),longTasksOver50ms:frames.longTasks.filter(n=>n>=50).length,maxLongTaskMs:Math.max(0,...frames.longTasks),mainScriptMs:(after.ScriptDuration-before.ScriptDuration)*1000,mainTaskMs:(after.TaskDuration-before.TaskDuration)*1000,layoutMs:(after.LayoutDuration-before.LayoutDuration)*1000,styleMs:(after.RecalcStyleDuration-before.RecalcStyleDuration)*1000,mainHeapUsedBytes:after.JSHeapUsedSize,liveTileFetchesDuringRun:liveFetches-fetches});
    }
    if(version==='after')await page.getByText('Advanced settings',{exact:true}).click();
    const recalc=[],requestsBefore=terrainRequests,workersBefore=workerCreations;
    for(const weight of ['5','6','7']){
      const start=Date.now();await page.getByLabel('Terrain penalty strength',{exact:true}).fill(weight);await expect(page.locator('.route-option')).toHaveCount(0);await expect(page.locator('.route-option')).toHaveCount(count,{timeout:45000});recalc.push(Date.now()-start);
    }
    versions.push({version,url,routesPerCalculation:count,runs,summary:{medianScriptMs:median(runs.map(r=>r.mainScriptMs)),medianTaskMs:median(runs.map(r=>r.mainTaskMs)),medianP95FrameMs:median(runs.map(r=>r.p95FrameMs)),medianMainHeapUsedBytes:median(runs.map(r=>r.mainHeapUsedBytes))},warmRecalculationMs:recalc,medianWarmRecalculationMs:median(recalc),terrainRequestsDuringWarmRecalculation:terrainRequests-requestsBefore,workersCreatedDuringWarmRecalculation:workerCreations-workersBefore});
    await context.close();
  }
  const report={recordedAt:new Date().toISOString(),baselineCommit:'9a0936d',candidate:'V2 working tree before P2 commit',browser:browser.version(),platform:os.platform(),cpu:os.cpus()[0]?.model,viewport:[1440,900],method:'Three warm repetitions of 90 pointer moves at ~16 ms spacing, followed by an exact drag-and-return. Genuine NASA tile responses cached in memory across both versions; each run records remaining live cache misses. CDP main-thread metrics plus requestAnimationFrame and Long Task observations. Both builds served locally on the same machine. Warm lambda changes measured separately.',limitations:['Headless desktop Chromium; no guarantee for mobile hardware or all networks.','Main JS heap excludes worker terrain arrays and GPU memory.','Two V1 versus three V2 route candidates; layout and rendering differ.','NASA live request durations are individual network operations, not page-load or frame timings.','Baseline immutable Vercel URL required SSO, so original commit was built in an isolated local worktree.'],versions,liveNasaNetwork:liveNetwork};
  writeFileSync('data/validation/performance.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(versions.map(v=>({version:v.version,...v.summary,warmRecalculationMs:v.warmRecalculationMs,terrainRequestsDuringWarmRecalculation:v.terrainRequestsDuringWarmRecalculation,workersCreatedDuringWarmRecalculation:v.workersCreatedDuringWarmRecalculation})),null,2));
});
