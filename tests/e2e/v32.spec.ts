import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("full-width destination images and overlay scrollbar drag, fade and native keyboard scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?place=mawrth");
  const view = page.locator('[data-active="true"] .panel-scroll');
  const area = page.locator('.workflow-view[data-active="true"]');
  const dimensions = await view.evaluate((node) => ({ width: node.clientWidth, outer: node.getBoundingClientRect().width }));
  expect(dimensions.width).toBe(dimensions.outer);
  expect((await page.locator('.location-image').boundingBox())!.width).toBe(dimensions.width);
  await view.hover();
  const track = area.locator('.scroll-track[data-axis="vertical"]');
  await expect(track).toHaveAttribute('data-overflow', 'true');
  const thumb = (await track.locator('.scroll-thumb').boundingBox())!;
  expect(thumb.height).toBeGreaterThanOrEqual(44);
  await page.mouse.move(thumb.x + 12, thumb.y + 12);
  await page.mouse.down();
  await page.mouse.move(thumb.x + 12, thumb.y + 95, { steps: 8 });
  await page.mouse.up();
  expect(await view.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  await page.mouse.move(1, 1);
  await expect(track).toHaveCSS('opacity', '0');
  await expect(track).toHaveCSS('pointer-events', 'none');
  await view.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => view.evaluate((node) => node.scrollTop)).toBe(0);
  await page.keyboard.press('PageDown');
  await expect.poll(() => view.evaluate((node) => node.scrollTop)).toBeGreaterThan(50);
  await page.waitForTimeout(250); // Wait for the browser's native keyboard scroll to settle.
  const previous = await view.evaluate((node) => node.scrollTop);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const inactive = page.locator('.scroll-viewport[aria-label="Destination details"]');
  expect(await inactive.evaluate((node) => node.scrollTop)).toBe(previous);
});

test("same-input recalculation retains analysis, disclosures, profile and strategy while exports wait for fresh samples", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const property = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { ...property, set(listener: (event: MessageEvent) => void) {
      property.set!.call(this, (event: MessageEvent) => {
        if (event.data.kind === 'analysis' && document.documentElement.dataset.delayAnalysis)
          setTimeout(() => listener.call(this, event), 1400);
        else listener.call(this, event);
      });
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.getByRole('button', { name: 'Try Jezero terrain example' }).click();
  const analysis = page.locator('.environment-analysis');
  await expect(analysis.locator('.factor-detail')).toHaveCount(4);
  await page.locator('.route-option').nth(1).click();
  const selected = await page.locator('.route-option.selected').textContent();
  await analysis.locator('.factor-detail').first().locator('summary').click();
  await page.getByRole('combobox', { name: 'Route profile', exact: true }).selectOption('temperature');
  await analysis.scrollIntoViewIfNeeded();
  const before = (await analysis.boundingBox())!.height;
  await page.evaluate(() => { document.documentElement.dataset.delayAnalysis = 'yes'; });
  await page.getByRole('button', { name: 'Recalculate', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
  await expect(analysis.locator('.analysis-update-note')).toHaveText('Updating');
  expect((await analysis.boundingBox())!.height).toBe(before);
  expect(await page.locator('.route-option.selected').textContent()).toBe(selected);
  await expect(analysis.locator('.factor-detail').first()).toHaveAttribute('open', '');
  await expect(page.getByRole('combobox', { name: 'Route profile', exact: true })).toHaveValue('temperature');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export route & provenance' }).evaluate((node: HTMLButtonElement) => node.click()),
  ]);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.features[0].properties.analysisStatus).toBe('pending');
  expect(exported.features[0].properties.analysis).toBeUndefined();
  await expect(analysis.locator('.analysis-update-note')).toHaveText('');
  expect((await analysis.boundingBox())!.height).toBe(before);
});
