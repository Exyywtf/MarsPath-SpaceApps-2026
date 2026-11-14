import { test, expect } from '@playwright/test';
test('persistent worker, explicit endpoints, third click, dragging and export',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];let terrainFetches=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('jezero-elevation.f32'))terrainFetches++;});
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();
  await expect(page.locator('.route-option')).toHaveCount(0);
  await page.getByRole('button',{name:'Try Jezero terrain example'}).click();
  await expect(page.locator('.route-option')).toHaveCount(3,{timeout:45000});
  const before=await page.locator('.point-label strong').allTextContents(),map=page.getByRole('region',{name:'Interactive Mars map'});
  await expect(map).toHaveAttribute('data-animating','false');await map.click({position:{x:800,y:250}});
  await expect(page.locator('.point-label strong')).toHaveText(before);await expect(page.locator('.route-option')).toHaveCount(3);
  const box=(await map.boundingBox())!;const [x,y]=JSON.parse((await map.getAttribute('data-start-pixel'))!);
  await page.mouse.move(box.x+x,box.y+y);await page.mouse.down();await page.mouse.move(box.x+x+15,box.y+y+10,{steps:10});await page.mouse.up();
  await expect(page.locator('.point-label strong').first()).not.toHaveText(before[0]);
  await expect(page.locator('.route-option')).toHaveCount(3,{timeout:45000});
  await page.getByRole('button',{name:'Recalculate',exact:true}).click();await expect(page.locator('.route-option')).toHaveCount(3,{timeout:45000});
  expect(terrainFetches).toBe(1);
  await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('button',{name:'Directions',exact:true}).click();
  await expect(page.locator('.route-option')).toHaveCount(3);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export route & provenance'}).click();expect((await download).suggestedFilename()).toContain('.geojson');
  expect(errors).toEqual([]);await page.screenshot({path:'tmp/p0-routing-desktop.png'});
});
test('mobile resize preserves one panel and visible draggable endpoints',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();await page.getByRole('button',{name:'Try Jezero terrain example'}).click();
  await expect(page.locator('.route-option')).toHaveCount(3,{timeout:45000});
  await page.setViewportSize({width:390,height:844});
  const map=page.getByRole('region',{name:'Interactive Mars map'});await expect(map).toHaveAttribute('data-animating','false');
  const box=(await map.boundingBox())!,sheet=(await page.locator('.workflow-panel').boundingBox())!;
  await expect.poll(async()=>JSON.parse((await map.getAttribute('data-start-pixel'))!)[1]).toBeLessThan(sheet.y);
  const [x,y]=JSON.parse((await map.getAttribute('data-start-pixel'))!);
  expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(box.width);expect(y).toBeGreaterThan(130);
  const initial=await page.locator('.point-label strong').first().textContent();
  await page.mouse.move(box.x+x,box.y+y);await page.mouse.down();await page.mouse.move(box.x+x-8,box.y+y-8,{steps:8});await page.mouse.up();
  await expect(page.locator('.point-label strong').first()).not.toHaveText(initial!);await expect(page.locator('.route-option')).toHaveCount(3,{timeout:45000});
  await map.click({position:{x:200,y:220}});await expect(page.locator('.route-option')).toHaveCount(3);
  await expect(page.locator('.workflow-panel')).toHaveCount(1);await page.screenshot({path:'tmp/p0-routing-mobile.png'});
});
test('coordinate entry, swap, clear and geographic fallback work',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();
  for(const [label,lat,lon] of [['A','0','179'],['B','0','179.01']]){const editor=page.locator('.point-editor').nth(label==='A'?0:1);await editor.locator('summary').click();await page.getByLabel(label+' latitude',{exact:true}).fill(lat);await page.getByLabel(label+' longitude',{exact:true}).fill(lon);await page.getByRole('button',{name:'Apply '+label,exact:true}).click();}
  await expect(page.locator('.route-option')).toContainText('Geographic connection',{timeout:15000});await expect(page.locator('.route-metrics')).toHaveCount(0);
  await page.getByRole('button',{name:'Edit route',exact:true}).click();
  await page.getByRole('button',{name:'Swap A and B'}).click();await expect(page.locator('.point-label strong').first()).toContainText('179.010°E');
  await expect(page.locator('.route-option')).toContainText('Geographic connection');
  await page.getByRole('button',{name:'Edit route',exact:true}).click();
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.locator('.route-option')).toHaveCount(0);
  const map=page.getByRole('region',{name:'Interactive Mars map'});await page.getByRole('button',{name:'Set A on map'}).click();await map.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.placement-instruction')).toHaveCount(0);await expect(page.locator('.point-label strong').first()).not.toContainText('Choose');
});
test('invalid coordinates preserve the draft and three ordered waypoints can be edited',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();await page.getByRole('button',{name:'Try Jezero terrain example'}).click();
  const original=await page.locator('.point-label strong').allTextContents();await page.locator('.point-editor').first().locator('summary').click();await page.getByLabel('A latitude',{exact:true}).fill('91');await page.getByRole('button',{name:'Apply A',exact:true}).click();
  await expect(page.locator('.field-error')).toContainText('Latitude');await expect(page.locator('.point-label strong')).toHaveText(original);
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Add waypoint',exact:true}).click();const map=page.getByRole('region',{name:'Interactive Mars map'});await expect(map).toBeFocused();if(i)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('.waypoint-row')).toHaveCount(i+1);}
  await expect(page.getByRole('button',{name:'Add waypoint',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Remove stop 2',exact:true}).click();await expect(page.locator('.waypoint-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.locator('.waypoint-row')).toHaveCount(0);await expect(page.locator('.route-option')).toHaveCount(0);
});
