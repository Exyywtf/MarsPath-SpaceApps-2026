import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { locations } from "../../lib/atlas";
import AxeBuilder from "@axe-core/playwright";

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

test("coordinate triggers stay fixed through rapid reversals and restore focus without losing errors", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.getByRole('button', { name: 'Expand panel fully', exact: true }).click();
  const editor = page.locator('.point-editor').first();
  const trigger = editor.getByRole('button', { name: 'Coordinates', exact: true });
  const before = (await trigger.boundingBox())!;
  await trigger.click();
  await page.waitForTimeout(65);
  const middle = await editor.locator('.accordion-body').evaluate((node) => node.getBoundingClientRect().height);
  expect(middle).toBeGreaterThan(0);
  await trigger.click();
  await page.waitForTimeout(45);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('A latitude', { exact: true }).fill('91');
  await page.getByRole('button', { name: 'Apply A', exact: true }).click();
  await expect(editor.locator('.field-error')).toBeVisible();
  const after = (await trigger.boundingBox())!;
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  await page.getByLabel('A latitude', { exact: true }).focus();
  await trigger.evaluate((node: HTMLButtonElement) => node.click());
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(editor.locator('.field-error')).toBeVisible();
  expect((await page.locator('.planning-settings > .accordion > .accordion-actions .accordion-trigger').allTextContents())
    .map((value) => value.replace(/\s+/g, ' ').trim()))
    .toEqual(['Science objectives Optional', 'Climate preferences', 'Advanced settings']);
  await expect(page.getByRole('button', { name: 'Recalculate', exact: true })).toBeDisabled();
  expect(await page.getByRole('button', { name: 'Recalculate', exact: true }).evaluate((node) => node.previousElementSibling?.textContent))
    .toContain('Choose A and B to begin.');
});

test("touch-first panels keep native scrolling and selectable controls", async ({ browser, browserName }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto((process.env.BASE_URL ?? 'http://127.0.0.1:3000') + '/?place=mawrth');
    await page.getByRole('button', { name: 'Expand panel fully', exact: true }).tap();
    await page.locator('.workflow-panel').evaluate((node) => Promise.all(node.getAnimations()
      .map((animation) => animation.finished.catch(() => undefined))));
    const view = page.getByRole('region', { name: 'Destination details', exact: true });
    if (browserName === 'chromium') {
      const session = await context.newCDPSession(page), rect = (await view.boundingBox())!;
      const x = rect.x + rect.width/2, y = rect.y + rect.height*.7;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 12; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y-step*15 }] });
        await page.waitForTimeout(20);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else {
      // Mobile WebKit exposes touch tapping and hardware-keyboard scrolling.
      await view.focus();
      await page.keyboard.press('PageDown');
    }
    await expect.poll(() => view.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole('button', { name: 'About this position', exact: true }).tap();
    await expect(page.getByRole('link', { name: 'Coordinate evidence' })).toBeVisible();
  } finally { await context.close(); }
});

test("HUD docking and Show map preserve the camera across nine sizes and workflow switches", async ({ page }) => {
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[834,1194],[1194,834],[390,844],[375,667],[844,390]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?place=jezero');
    const map = page.getByRole('region', { name: 'Interactive Mars map' });
    await expect(map).toHaveAttribute('data-ready', 'true');
    await expect(map).toHaveAttribute('data-animating', 'false');
    const center = await map.getAttribute('data-center');
    const resolution = await map.getAttribute('data-resolution');
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(map).toHaveAttribute('data-center', center!);
    await expect(map).toHaveAttribute('data-resolution', resolution!);
    const positions = await page.locator('.atlas').evaluate((node) => {
      const hud = node.querySelector('.map-controls')!.getBoundingClientRect();
      const panel = node.querySelector('.workflow-panel')!.getBoundingClientRect();
      const footer = node.querySelector('.map-footer')!.getBoundingClientRect();
      const sidebar = getComputedStyle(node.querySelector('.workflow-panel')!).getPropertyValue('--side-panel').trim() === '1';
      return { hud: hud.toJSON(), panel: panel.toJSON(), footer: footer.toJSON(), sidebar };
    });
    expect(positions.hud.bottom).toBeLessThan(positions.footer.top);
    if (!positions.sidebar) {
      if (positions.hud.left < positions.panel.right && positions.hud.right > positions.panel.left)
        expect(positions.hud.bottom).toBeLessThan(positions.panel.top);
      await page.getByRole('button', { name: 'Expand panel fully', exact: true }).click();
      const showMap = page.getByRole('button', { name: 'Show map', exact: true });
      if (positions.hud.left < positions.panel.right && positions.hud.right > positions.panel.left) {
        await expect(showMap).toBeVisible();
        await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeHidden();
        await showMap.click();
        await expect(map).toBeFocused();
      } else {
        await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Reduce panel', exact: true }).click();
      }
      await expect(page.locator('.workflow-panel')).toHaveClass(/sheet-half/);
      await expect(map).toHaveAttribute('data-center', center!);
      await expect(map).toHaveAttribute('data-resolution', resolution!);
    }
  }
});

test("all thirteen cards keep equal header columns and full-width 205 px source images", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    for (const location of locations) {
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await page.locator('.destination').filter({ hasText: location.name }).click();
      const header = page.locator('.detail-panel .panel-header');
      const geometry = await header.evaluate((node) => {
        const back = node.querySelector('[aria-label="Back to destinations"]')!.getBoundingClientRect();
        const close = node.querySelector('[aria-label="Close panel"]')!.getBoundingClientRect();
        const title = node.querySelector('h1')!.getBoundingClientRect();
        return { back: back.width, close: close.width, center: title.x + title.width/2, panel: node.getBoundingClientRect().x + node.getBoundingClientRect().width/2 };
      });
      expect(geometry.back).toBe(44);
      expect(geometry.close).toBe(44);
      expect(Math.abs(geometry.center - geometry.panel)).toBeLessThan(1);
      if (location.image) {
        const image = (await page.locator('.location-image').boundingBox())!;
        expect(image.height).toBe(205);
        expect(image.width).toBe(await page.locator('.scroll-viewport[aria-label="Destination details"]').evaluate((node) => node.clientWidth));
      }
    }
  }
});

test("floating scientific details clear a tablet sheet when the zoom controls already fit beside it", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: /^Atmospheric pressure/ }).click();

  const map = page.getByRole('region', { name: 'Interactive Mars map' });
  const panel = page.locator('.workflow-panel');
  const legend = page.locator('.map-legend');
  const inspection = page.locator('.inspection-card');
  await expect(legend).toBeVisible();
  const panelTop = (await panel.boundingBox())!.y;
  await expect.poll(async () => {
    const box = (await legend.boundingBox())!;
    return box.y + box.height;
  }).toBeLessThan(panelTop);

  await map.focus();
  await page.keyboard.press('Enter');
  await expect(inspection).toBeVisible();
  await expect.poll(async () => {
    const box = (await inspection.boundingBox())!;
    return box.y + box.height;
  }).toBeLessThan(panelTop);
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
});

test("native document scrolling, table overflow, links and icon metadata remain accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/methodology/#validation-v2');
  await expect(page.locator('#validation-v2')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  const table = page.getByRole('region', { name: 'Independent route validation results' });
  await table.scrollIntoViewIfNeeded();
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await page.goto('/sources/');
  await page.getByLabel('Filter source type').selectOption('Historical illustration');
  await page.locator('#pia03480 .accordion-trigger').click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
  expect(await page.locator('.source-select svg').count()).toBe(1);
  await expect(page.locator('.evidence-tail').first()).toHaveCSS('white-space', 'nowrap');
  const icons = await page.locator('link[rel="icon"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLLinkElement).href));
  expect(icons.some((href) => href.includes('icon.svg'))).toBe(true);
  expect(icons.some((href) => href.includes('favicon.ico'))).toBe(true);
  for (const icon of icons) expect((await page.request.get(icon)).ok()).toBe(true);
});

test("standard Link navigation uses static payloads and page transitions without reloading the document", async ({ page, browserName }) => {
  await page.addInitScript(() => {
    const token = crypto.randomUUID();
    addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.documentToken = token; }, { once: true });
    const start = document.startViewTransition;
    if (start) document.startViewTransition = function (...args: Parameters<typeof start>) {
      document.documentElement.dataset.viewTransitions = String(Number(document.documentElement.dataset.viewTransitions ?? 0) + 1);
      return start.apply(this, args);
    };
  });
  await page.goto('/sources/');
  const token = await page.locator('html').getAttribute('data-document-token');
  const method = page.getByRole('link', { name: 'Methodology', exact: true });
  await method.hover();
  await page.request.get('/methodology/__next.methodology.__PAGE__.txt').then((response) => {
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/x-component');
  });
  await method.click();
  await expect(page.getByRole('heading', { name: 'MarsPath methodology', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-document-token', token!);
  if (browserName === 'chromium') await expect(page.locator('html')).toHaveAttribute('data-view-transitions', /[1-9]/);
  else await expect(page.locator('.page-shell')).toHaveAttribute('data-page-motion', 'entry');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Evidence behind the exploration' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-document-token', token!);
});

test("same-input recalculation retains analysis, disclosures, profile and strategy while exports wait for fresh samples", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const property = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { ...property, set(listener: (event: MessageEvent) => void) {
      property.set!.call(this, (event: MessageEvent) => {
        if (event.data.kind !== 'analysis') {
          listener.call(this, event);
          return;
        }
        // Model a finished ranking that differs from the provisional scores.
        const ranked = new MessageEvent('message', { data: { ...event.data, scores: [0, 1, 1] } });
        if (document.documentElement.dataset.delayAnalysis)
          setTimeout(() => listener.call(this, ranked), 1400);
        else listener.call(this, ranked);
      });
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.getByRole('button', { name: 'Try Jezero terrain example' }).click();
  const analysis = page.locator('.environment-analysis');
  await expect(analysis.locator('.factor-detail')).toHaveCount(4);
  const firstRoute = page.locator('.route-option').first();
  await expect(firstRoute).toContainText('Recommended by your preferences');
  await page.locator('.route-option').nth(1).click();
  const selected = await page.locator('.route-option.selected').textContent();
  await analysis.locator('.factor-detail').first().locator('.accordion-trigger').click();
  await page.getByRole('combobox', { name: 'Route profile', exact: true }).selectOption('temperature');
  await analysis.scrollIntoViewIfNeeded();
  const before = (await analysis.boundingBox())!.height;
  await page.evaluate(() => { document.documentElement.dataset.delayAnalysis = 'yes'; });
  await page.getByRole('button', { name: 'Recalculate', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
  const exportRoute = page.getByRole('button', { name: 'Export route & provenance' });
  await expect(exportRoute).toBeEnabled();
  await expect(analysis.locator('.analysis-update-note')).toHaveText('Updating');
  await expect(firstRoute).toContainText('Recommended by your preferences');
  expect((await analysis.boundingBox())!.height).toBe(before);
  expect(await page.locator('.route-option.selected').textContent()).toBe(selected);
  await expect(analysis.locator('.factor-detail').first()).toHaveAttribute('data-open', 'true');
  await expect(page.getByRole('combobox', { name: 'Route profile', exact: true })).toHaveValue('temperature');
  const chevron = await page.locator('.profile-chart .styled-select > svg').boundingBox();
  expect(chevron?.width).toBe(16);
  expect(chevron?.height).toBe(16);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportRoute.evaluate((node: HTMLButtonElement) => node.click()),
  ]);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.features[0].properties.analysisStatus).toBe('pending');
  expect(exported.features[0].properties.analysis).toBeUndefined();
  expect(exported.features[0].properties.rankingStatus).toBe('pending');
  expect(exported.features[0].properties.ranking).toBeUndefined();
  await expect(analysis.locator('.analysis-update-note')).toHaveText('');
  expect((await analysis.boundingBox())!.height).toBe(before);
});
