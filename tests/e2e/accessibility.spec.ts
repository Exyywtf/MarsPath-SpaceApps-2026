import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('accessible explore, directions, layers and modal states',async({page})=>{
  await page.goto('/');
  const check=async()=>{const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);};
  await check();await page.getByRole('button',{name:'Directions',exact:true}).click();await page.getByRole('button',{name:'Try Jezero terrain example'}).click();await expect(page.locator('.route-option')).toHaveCount(3);await check();
  await page.getByRole('button',{name:'Layers',exact:true}).click();await page.getByRole('button',{name:/^Atmospheric pressure/}).click();await check();
  await page.getByRole('button',{name:'Help and keyboard shortcuts'}).click();await check();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Help and keyboard shortcuts'})).toBeFocused();
});
test('keyboard placement, Escape hierarchy, shortcuts and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Directions',exact:true}).click();
  await page.getByRole('button',{name:'Set A on map'}).click();await page.keyboard.press('Escape');await expect(page.locator('.placement-instruction')).toHaveCount(0);await expect(page.locator('.workflow-panel h1')).toHaveText('Directions');
  await page.getByRole('button',{name:'Set A on map'}).click();await page.keyboard.press('Enter');await expect(page.locator('.point-label strong').first()).not.toContainText('Choose');
  await page.keyboard.press('/');await expect(page.getByLabel('Search scientific destinations')).toBeFocused();await page.keyboard.type('R');await expect(page.locator('.workflow-panel h1')).toHaveText('Explore Mars');
  await page.getByLabel('Search scientific destinations').fill('Jezero');await page.locator('.destination').click();
  const map=page.getByRole('region',{name:'Interactive Mars map'});await expect(map).toHaveAttribute('data-animating','false');
  await page.setViewportSize({width:390,height:844});const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);
});
