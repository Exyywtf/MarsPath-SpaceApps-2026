import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const phone = viewport.width < 700;
  test.describe(phone ? "phone" : "desktop", () => {
    test.use({ viewport, hasTouch: phone, reducedMotion: "reduce" });

    test("replacing A after Use as A keeps Directions available", async ({ page }) => {
      await page.goto("/?place=jezero");
      await page.getByRole("button", { name: "Use as A", exact: true }).click();
      const panel = page.getByRole("complementary", { name: "Directions" });
      const choose = panel.getByRole("button", { name: "Set A on map", exact: true });
      const a = panel.locator(".point-label strong").first();
      const original = await a.innerText();
      const map = page.getByRole("region", { name: "Interactive Mars map" });
      const height = (await panel.boundingBox())!.height;

      await choose.click();
      await expect(panel).not.toHaveClass(/sheet-peek/);
      await expect(panel.locator(".workflow-stack")).not.toHaveAttribute("inert");
      await expect(map).toBeFocused();
      await page.getByRole("button", { name: "Cancel point placement" }).click();
      await expect(a).toHaveText(original);
      await expect(choose).toBeEnabled();

      await choose.click();
      await map.press("ArrowRight");
      await map.press("Enter");
      await expect(page.getByRole("button", { name: "Cancel point placement" })).toHaveCount(0);
      await expect(a).not.toHaveText(original);
      await expect(choose).toBeEnabled();
      expect((await panel.boundingBox())!.height).toBe(height);
    });

    test("repositioning a station preserves the mission and the sheet", async ({ page }) => {
      await page.goto("/?place=jezero");
      await page.getByRole("button", { name: "Use as A", exact: true }).click();
      await page.getByRole("button", { name: "Mission Planner", exact: true }).click();
      const panel = page.getByRole("complementary", { name: "Mission Planner" });
      if (phone) await panel.getByRole("button", { name: "Expand panel fully" }).tap();
      await panel.getByRole("button", { name: "Communications assumptions" }).click();
      await panel.getByRole("button", { name: "Use A as station" }).click();
      const station = panel.locator(".quality-details").filter({ has: page.getByRole("button", { name: "Place station on map" }) });
      const coordinate = station.locator(".small-note").first();
      const before = await coordinate.innerText();
      const choose = station.getByRole("button", { name: "Place station on map" });
      const height = (await panel.boundingBox())!.height;
      const map = page.getByRole("region", { name: "Interactive Mars map" });
      await station.getByLabel("Station antenna height (m)").fill("3");

      await choose.click();
      await expect(panel.locator(".workflow-stack")).not.toHaveAttribute("inert");
      await expect(panel).toHaveAttribute("data-placing", "true");
      if (phone) expect((await panel.boundingBox())!.height).toBeLessThan(height);
      await map.press("Escape");
      await expect(choose).toBeEnabled();
      await expect(coordinate).toHaveText(before);

      await choose.click();
      await map.press("ArrowUp");
      await map.press("Enter");
      await expect(panel).not.toHaveAttribute("data-placing");
      await expect(choose).toBeEnabled();
      await expect(coordinate).not.toHaveText(before);
      await expect(station.getByLabel("Station antenna height (m)")).toHaveValue("3");
      await expect(panel.locator(".point-label strong").first()).toHaveText(before);
      expect((await panel.boundingBox())!.height).toBe(height);
    });
  });
}
