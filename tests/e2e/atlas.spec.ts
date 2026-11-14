import { test, expect } from '@playwright/test';
import locations from '../../data/locations.json';
test('NASA tiles, all destinations, search and layer view preservation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const tile=page.waitForResponse(r=>r.url().includes('trek.nasa.gov/tiles/Mars/')&&r.status()===200);
  await page.goto('/');await tile;await expect(page.locator('.destination')).toHaveCount(locations.length);
  await page.getByLabel('Search scientific destinations').fill('Oxia');await page.locator('.destination').click();await expect(page.locator('.detail-panel h1')).toHaveText('Oxia Planum');await expect(page.locator('.coordinates')).toContainText('17.280°N');
  const map=page.getByRole('region',{name:'Interactive Mars map'});
  const oxia=locations.find(location=>location.id==='oxia')!;
  await expect(map).toHaveAttribute('data-animating','false');
  await expect.poll(async () => {
    const [lon, lat] = JSON.parse((await map.getAttribute("data-center"))!);
    return Math.hypot(lon - oxia.coordinates[0], lat - oxia.coordinates[1]);
  }).toBeLessThan(7);
  const centre=await map.getAttribute('data-center');
  await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('button',{name:'MOLA relief',exact:false}).click();await expect(map).toHaveAttribute('data-center',centre!);
  await page.getByLabel('Topographic relief',{exact:false}).check();await page.getByLabel('Topography opacity').fill('0.25');expect(errors).toEqual([]);
  await page.screenshot({path:'tmp/p0-atlas-desktop.png'});
});
test('Jezero loads real HiRISE and every place offers directions',async({page})=>{
  await page.goto('/');await page.getByLabel('Search scientific destinations').fill('Jezero');await page.locator('.destination').click();
  const tile=page.waitForResponse(r=>r.url().includes('JEZ_hirise_soc_006')&&r.status()===200);await page.getByRole('button',{name:'Explore orbital imagery'}).click();await tile;
  await expect(page.locator('.imagery-label')).toContainText('HiRISE');await page.getByRole('button',{name:'Route here'}).click();await expect(page.locator('.point-label strong').nth(1)).toContainText('18.410°N');
});
test('mobile search, sources, help and reduced motion',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  const dismiss=page.getByRole('button',{name:'Dismiss getting started'});if(await dismiss.count())await dismiss.click();
  await page.getByLabel('Search scientific destinations').fill('Jezero');await page.locator('.destination').click();await expect(page.locator('.detail-panel h1')).toHaveText('Jezero Crater');
  await page.getByRole('button',{name:'Help and keyboard shortcuts'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/sources/');await page.getByLabel('Search sources').fill('CTX');await expect(page.locator('.source-record').first()).toBeVisible();await page.screenshot({path:'tmp/p0-sources-mobile.png'});
});
test('all destinations can become B and mobile sheets can be dragged',async({page})=>{
  await page.goto('/');
  for(const location of locations){await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByLabel('Search scientific destinations').fill(location.name);await page.locator('.destination').click();await page.getByRole('button',{name:'Route here',exact:true}).click();await expect(page.locator('.point-label strong').nth(1)).not.toContainText('Choose');}
  await page.setViewportSize({width:390,height:844});const grip=page.locator('.sheet-grip'),box=(await grip.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+9);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y-160,{steps:12});await page.mouse.up();await expect(page.locator('.workflow-panel')).toHaveClass(/sheet-full/);
  await page.getByRole('button',{name:'Collapse panel',exact:true}).click();await expect(page.locator('.workflow-panel')).toHaveClass(/sheet-peek/);await page.getByRole('button',{name:'Expand panel',exact:true}).click();await expect(page.locator('.workflow-panel')).toHaveClass(/sheet-half/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
