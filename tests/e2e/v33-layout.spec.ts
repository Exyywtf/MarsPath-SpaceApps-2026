import { expect, test } from "@playwright/test";

test("sheet workflows share a compact header and keep touch-size controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [[1024, 768], [834, 1194], [390, 844], [375, 667], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?place=mawrth");
    const sheet = page.locator(".workflow-panel");
    const grip = sheet.locator(".sheet-grip");
    const header = sheet.locator(".panel-header");
    await expect(grip).toHaveCSS("height", "44px");
    for (const name of ["Mawrth Vallis", "Explore Mars", "Map layers", "Directions"]) {
      if (name !== "Mawrth Vallis") {
        const tab = name === "Explore Mars" ? "Explore" : name === "Map layers" ? "Layers" : name;
        await page.getByRole("button", { name: tab, exact: true }).click();
      }
      await expect(header.getByRole("heading")).toHaveText(name);
      const row = (await header.boundingBox())!, toolbar = (await grip.boundingBox())!;
      expect(row.height).toBeCloseTo(48, 0);
      expect(row.y).toBeCloseTo(toolbar.y + toolbar.height, 0);
      for (const control of await grip.locator(".sheet-buttons button").all()) {
        const box = (await control.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.getByRole("button", { name: "Collapse panel", exact: true }).click();
    const wrapper = sheet.locator(".workflow-header");
    await expect.poll(async () => (await sheet.boundingBox())!.height - (await wrapper.boundingBox())!.height).toBeCloseTo(2, 0);
    await expect(sheet.locator('.panel-scroll[aria-label="Directions planner"]')).not.toBeVisible();
    await page.getByRole("button", { name: "Expand panel", exact: true }).click();
    await expect(sheet).toHaveClass(/sheet-half/);
    const handle = (await grip.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 20);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 40, { steps: 5 });
    await page.mouse.up();
    await expect(sheet).toHaveClass(/sheet-full/);
  }

  await page.goto("/?place=sirenum");
  await expect(page.locator(".panel-header h1")).toHaveText("Terra Sirenum · Chlorides");
  const wrapped = (await page.locator(".panel-header").boundingBox())!;
  expect(wrapped.height).toBeGreaterThan(48);
  await page.getByRole("button", { name: "Collapse panel", exact: true }).click();
  await expect.poll(async () => (await page.locator(".workflow-panel").boundingBox())!.height).toBeCloseTo(wrapped.height + 46, 0);

  for (const [width, height] of [[1920, 1080], [1440, 900], [1194, 834], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?place=mawrth");
    await expect(page.locator(".sheet-grip")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Mawrth Vallis" })).toBeVisible();
  }
});

test("Apply A and B use the same centred control during and after expansion", async ({ page }) => {
  for (const [width, height] of [[1920, 1080], [1440, 900], [834, 1194], [375, 667]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Directions", exact: true }).click();
    const expand = page.getByRole("button", { name: "Expand panel fully", exact: true });
    if (await expand.isVisible()) await expand.click();
    const styles = [];
    for (const label of ["A", "B"]) {
      const editor = page.locator(".point-editor").nth(label === "A" ? 0 : 1);
      const trigger = editor.getByRole("button", { name: "Coordinates", exact: true });
      await trigger.click();
      const apply = editor.locator(".coordinate-apply");
      const read = () => apply.evaluate((node) => {
        const outer = node.getBoundingClientRect(), text = node.querySelector("span")!.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { x: text.x + text.width / 2 - outer.x - outer.width / 2, y: text.y + text.height / 2 - outer.y - outer.height / 2,
          width: outer.width, height: outer.height, font: style.fontSize, radius: style.borderRadius };
      });
      const during = await read();
      expect(Math.abs(during.x)).toBeLessThan(1);
      expect(Math.abs(during.y)).toBeLessThan(1);
      await editor.locator(".accordion-body").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => undefined))));
      const settled = await read();
      expect(settled.x).toBeCloseTo(during.x, 0);
      expect(settled.y).toBeCloseTo(during.y, 0);
      expect(settled.height).toBeGreaterThanOrEqual(44);
      styles.push({ width: settled.width, height: settled.height, font: settled.font, radius: settled.radius });
    }
    expect(styles[0]).toEqual(styles[1]);
    await expect(page.getByRole("heading", { name: "Directions", exact: true })).toBeVisible();
  }
});
