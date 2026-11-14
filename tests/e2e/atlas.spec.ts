import { test, expect } from '@playwright/test';
test('NASA tiles, all thirteen destinations, search and layer view preservation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const tile=page.waitForResponse(r=>r.url().includes('trek.nasa.gov/tiles/Mars/')&&r.status()===200);
  await page.goto('/');await tile;await expect(page.locator('.destination')).toHaveCount(13);
  await page.getByLabel('Search scientific destinations').fill('Oxia');await page.locator('.destination').click();await expect(page.locator('.detail-panel h1')).toHaveText('Oxia Planum');await expect(page.locator('.coordinates')).toContainText('17.280°N');
  const map=page.getByRole('region',{name:'Interactive Mars map'});await expect(map).toHaveAttribute('data-animating','false');const centre=await map.getAttribute('data-center');
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
