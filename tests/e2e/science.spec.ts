import { test,expect } from '@playwright/test';
async function coordinates(page:import('@playwright/test').Page,label:string,lat:string,lon:string){const editor=page.locator('.point-editor').nth(label==='A'?0:1);await editor.locator('.accordion-trigger').click();await page.getByLabel(label+' latitude',{exact:true}).fill(lat);await page.getByLabel(label+' longitude',{exact:true}).fill(lon);await page.getByRole('button',{name:'Apply '+label,exact:true}).click();}
test('coarse global routing crosses the date line with truthful resolution',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();
  await coordinates(page,'A','0','179');await coordinates(page,'B','0','-179');
  await expect(page.locator('.route-option')).toHaveCount(1,{timeout:45000});await expect(page.locator('.route-status')).toContainText('0.25°');
  await expect(page.locator('.route-option')).toContainText('found the same path');
  await page.getByRole('button',{name:'Fit on map',exact:true}).click();
  const map=page.getByRole('region',{name:'Interactive Mars map'});
  await expect.poll(async()=>{
    const centre=JSON.parse((await map.getAttribute('data-center'))!);
    return Math.abs(((centre[0]+180)%360+360)%360-180);
  }).toBeGreaterThan(175);
  await expect.poll(async()=>Number(await map.getAttribute('data-resolution'))).toBeLessThan(.02);
  await expect(page.locator('.data-note').filter({hasText:'Coarse exploration context'})).toContainText('not a practical EVA');
  await page.getByText('Data quality & coverage',{exact:true}).click();await expect(page.locator('.quality-details').filter({hasText:'Native source spacing'})).toContainText('463.0935');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export route & provenance'}).click();const file=await download;expect(file.suggestedFilename()).toContain('coarse');await page.screenshot({path:'tmp/p2-coarse-routing.png'});
});
test('science preferences select a real published outcrop and profile is keyboard inspectable',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();await page.getByRole('button',{name:'Try Jezero terrain example'}).click();
  await page.locator('.science-objectives > .accordion-actions .accordion-trigger').click();await page.getByLabel('Ancient water',{exact:true}).check();await page.getByText('Advanced settings',{exact:true}).click();
  await page.getByLabel('Distance preference',{exact:true}).fill('0');await page.getByLabel('Terrain preference',{exact:true}).fill('0');await page.getByLabel('Science preference',{exact:true}).fill('100');
  await page.locator('.route-option').filter({hasText:'Science-aware route'}).click({timeout:15000});
  await expect(page.locator('.science-outcome')).toContainText('1 / 1');await expect(page.locator('.science-outcome')).toContainText('outcrop');
  const scrubber=page.getByLabel('Inspect elevation along route');await scrubber.focus();await page.keyboard.press('ArrowRight');await expect(scrubber).toHaveAttribute('aria-valuetext',/elevation/);
  await page.screenshot({path:'tmp/p2-science-routing.png'});
});
test('a published outcrop marker opens its evidence without changing endpoints',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();await page.getByRole('button',{name:'Try Jezero terrain example'}).click();await expect(page.locator('.route-option')).toHaveCount(3);
  const map=page.getByRole('region',{name:'Interactive Mars map'});await expect(map).toHaveAttribute('data-animating','false');
  const before=await page.locator('.point-label strong').allTextContents(),[x,y]=JSON.parse((await map.getAttribute('data-start-pixel'))!),resolution=Number(await map.getAttribute('data-resolution'));
  const a=[77.41909183169858,18.46594223036952],target=[77.387,18.472];
  await map.click({position:{x:x+(target[0]-a[0])/resolution,y:y-(target[1]-a[1])/resolution}});
  await expect(page.locator('#jezero-d-tcl')).toBeVisible();await expect(page.locator('#jezero-d-tcl')).toBeFocused();await expect(page.locator('.point-label strong')).toHaveText(before);
});
