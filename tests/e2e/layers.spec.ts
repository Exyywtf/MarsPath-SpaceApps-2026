import { test,expect } from '@playwright/test';
test('four real numerical overlays preserve the view and expose model context',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Layers',exact:true}).click();
  const map=page.getByRole('region',{name:'Interactive Mars map'});await expect(map).toHaveAttribute('data-animating','false');const centre=await map.getAttribute('data-center');
  const names=['MOLA elevation','Atmospheric temperature','Atmospheric pressure','Horizontal wind speed'];
  for(const [index,name] of names.entries()){
    const image=page.waitForResponse(r=>r.url().includes('/processed/')&&r.url().endsWith('.png')&&r.status()===200);
    await page.getByRole('button',{name:new RegExp('^'+name)}).click();await image;
    await expect(page.locator('.map-legend')).toContainText(name);await expect(map).toHaveAttribute('data-center',centre!);
    const coordinates=page.locator('.inspection-card p');
    const previous=await coordinates.count()?await coordinates.textContent():null;
    await map.click({position:{x:900+index*25,y:310+index*12}});
    await expect(coordinates).toBeVisible();
    if(previous)await expect(coordinates).not.toHaveText(previous);
    await expect(page.locator('.inspection-card>strong')).toHaveText(/^-?[\d,.]+ (m|K|Pa|m\/s)$/);
    await expect(map).toHaveAttribute('data-center',centre!);
    await page.getByLabel('Scientific layer opacity').fill('0.45');
  }
  await expect(page.locator('.layer-information')).toContainText('local time 00:00');await expect(page.locator('.layer-information')).toContainText('64 × 48');
  await page.screenshot({path:'tmp/p1-numerical-layers.png'});
});
