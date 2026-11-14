import { expect, it } from "vitest";
import { scrollbarGeometry } from "../../lib/scrollbar";

it("maps native offsets to an overlay track and keeps a 44 px drag target", () => {
  const geometry = scrollbarGeometry(300, 3000, 1350, 296);
  expect(geometry.size).toBe(44);
  expect(geometry.position).toBe(126);
  expect(geometry.position * geometry.scrollPerPixel).toBe(1350);
  expect(scrollbarGeometry(300, 3000, -8, 296).position).toBe(0);
  expect(scrollbarGeometry(300, 3000, 4000, 296).position).toBe(252);
  expect(scrollbarGeometry(300, 300, 0, 296).overflow).toBe(false);
  expect(scrollbarGeometry(0, 0, 0, 0).scrollPerPixel).toBe(0);
});
