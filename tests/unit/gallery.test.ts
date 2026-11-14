import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import images from "../../data/gallery.json";
import locations from "../../data/locations.json";

describe("destination gallery provenance", () => {
  it("has distinct, complete image records and matches each published derivative checksum", () => {
    expect(new Set(images.map((image) => image.id)).size).toBe(images.length);
    expect(new Set(images.map((image) => image.sourceSha256)).size).toBe(images.length);
    for (const location of locations) {
      const gallery = images.filter((image) => image.destinationId === location.id);
      expect(gallery.length, location.id).toBeGreaterThanOrEqual(3);
      expect(gallery.length, location.id).toBeLessThanOrEqual(5);
    }
    for (const image of images) {
      expect(locations.some((location) => location.id === image.destinationId)).toBe(true);
      for (const value of [image.caption, image.credit, image.instrument, image.relationship, image.terms, image.imageType]) expect(value.trim()).not.toBe("");
      for (const value of [image.sourcePage, image.originalImage, image.sourceRendition]) expect(new URL(value).protocol).toBe("https:");
      expect(image.asset).toMatch(/^\/images\/gallery\/[a-z0-9-]+\.webp$/);
      expect(createHash("sha256").update(readFileSync(`public${image.asset}`)).digest("hex")).toBe(image.sha256);
      expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(1280);
    }
  });
});
