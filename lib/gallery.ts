import records from "@/data/gallery.json";

export interface GalleryImage {
  id: string;
  destinationId: string;
  title: string;
  caption: string;
  asset: string;
  width: number;
  height: number;
  sourcePage: string;
  originalImage: string;
  sourceRendition: string;
  institution: string;
  credit: string;
  instrument: string;
  relationship: string;
  acquired?: string;
  imageType: string;
  terms: string;
  sourceSha256: string;
  sha256: string;
}

export const galleryImages: readonly GalleryImage[] = records;
const galleries = new Map<string, GalleryImage[]>();
for (const item of galleryImages) {
  const gallery = galleries.get(item.destinationId);
  if (gallery) gallery.push(item);
  else galleries.set(item.destinationId, [item]);
}

const empty: readonly GalleryImage[] = [];
export function destinationGallery(id: string): readonly GalleryImage[] {
  return galleries.get(id) ?? empty;
}
