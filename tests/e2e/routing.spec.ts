import { test, expect } from '@playwright/test';
test('real terrain worker compares routes and endpoints can be dragged',async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Mission planning'}).click();
  await expect(page.locator('.route-option')).toHaveCount(2,{timeout:45000});
  await expect(page.locator('.route-explanation')).toContainText('Endpoints snap');
  await expect(page.locator('.route-metrics')).toContainText('MAX SLOPE');
  const initial=await page.locator('.endpoint-row code').first().textContent();
  const map=page.getByRole('region',{name:'Interactive Mars map'});
  await expect.poll(async()=>Number(await map.getAttribute('data-resolution'))).toBeLessThan(.001);
  await expect(map).toHaveAttribute('data-animating','false');
  const box=(await map.boundingBox())!;
  // Locate A from the published example and the map's current view. A robust
  // DOM-free canvas interaction test uses endpoint pixel positions exposed as
  // geometry metadata on the accessible map container.
  const pixel=await map.getAttribute('data-start-pixel');
  expect(pixel).toBeTruthy();
  const [x,y]=JSON.parse(pixel!);
  await page.mouse.move(box.x+x,box.y+y);await page.mouse.down();await page.mouse.move(box.x+x+15,box.y+y+10,{steps:10});await page.mouse.up();
  await expect(page.locator('.endpoint-row code').first()).not.toHaveText(initial!);
  await expect(page.locator('.route-option')).toHaveCount(2,{timeout:45000});
  await page.getByLabel('Terrain penalty strength').fill('7');
  await expect(page.locator('.route-option')).toHaveCount(2,{timeout:45000});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export route & provenance'}).click();expect((await download).suggestedFilename()).toContain('.geojson');
  expect(errors).toEqual([]);
  await page.screenshot({path:'tmp/routing-desktop.png'});
});
test('mobile planner leaves draggable endpoints above its sheet and clears stale metrics',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Mission planning'}).click();
  await expect(page.locator('.route-option')).toHaveCount(2,{timeout:45000});
  const map=page.getByRole('region',{name:'Interactive Mars map'});
  await expect.poll(async()=>Number(await map.getAttribute('data-resolution'))).toBeLessThan(.001);
  await expect(map).toHaveAttribute('data-animating','false');
  const [x,y]=JSON.parse((await map.getAttribute('data-start-pixel'))!);
  const box=(await map.boundingBox())!;
  const sheet=(await page.locator('.planner-panel').boundingBox())!;
  expect(box.y+y).toBeLessThan(sheet.y);
  const initial=await page.locator('.endpoint-row code').first().textContent();
  await page.mouse.move(box.x+x,box.y+y);await page.mouse.down();await page.mouse.move(box.x+x-8,box.y+y-8,{steps:8});await page.mouse.up();
  await expect(page.locator('.endpoint-row code').first()).not.toHaveText(initial!);
  await expect(page.locator('.route-option')).toHaveCount(2,{timeout:45000});
  // One new map click clears the previous pair and must hide its old metrics.
  await map.click({position:{x:260,y:200}});
  await expect(page.locator('.route-option')).toHaveCount(0);
  await page.screenshot({path:'tmp/planner-mobile.png'});
});
