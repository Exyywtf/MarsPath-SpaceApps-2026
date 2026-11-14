import { test,expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
test('captures loaded before and after map layouts at all four required sizes',async({browser})=>{
  mkdirSync('tmp/v2-review',{recursive:true});
  for(const [name,url] of [['before','http://127.0.0.1:4318'],['after','http://127.0.0.1:3000']]){
    const target=name==='after'?(process.env.BASE_URL??url):url;
    const context=await browser.newContext(),page=await context.newPage();
    for(const [width,height] of [[1920,1080],[1440,900],[1024,768],[390,844]]){
      await page.setViewportSize({width,height});await page.goto(target);await page.waitForLoadState('networkidle');
      await expect(page.getByRole('region',{name:'Interactive Mars map'})).toHaveAttribute('data-animating','false');
      const dismiss=page.getByRole('button',{name:'Dismiss getting started'});if(await dismiss.count())await dismiss.click();
      await page.screenshot({path:'tmp/v2-review/'+name+'-'+width+'x'+height+'.png'});
    }
    await context.close();
  }
});
