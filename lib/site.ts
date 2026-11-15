import type { Metadata } from "next";

export const siteUrl = "https://marspath-spaceapps-2026.vercel.app";
export const repositoryUrl = "https://github.com/Exyywtf/MarsPath-SpaceApps-2026";
export const demo = {
  title: "MarsPath demo",
  description: "Follow a Jezero mission from route planning and science objectives to a downloadable Mission Brief.",
  poster: "/share/marspath-demo-poster-f95bb412.jpg",
  video: "/media/marspath-demo-f95bb412.mp4",
  quietVideo: "/media/marspath-demo-f95bb412-quiet.mp4",
  duration: 28.5,
} as const;

export function pageMetadata(path: string, title: string, description: string, watch = false): Metadata {
  const url = new URL(path, siteUrl).href;
  const image = {
    url: new URL(watch ? "/share/marspath-demo-f95bb412-v1.jpg" : "/share/marspath-atlas-2026-v1.jpg", siteUrl).href,
    type: "image/jpeg",
    width: 1200,
    height: 630,
    alt: watch ? "Watch the MarsPath demo. A Jezero atlas frame shows a planned traverse." :
      "MarsPath. Plan science traverses on Mars, with a route drawn over orbital imagery of Jezero Crater.",
  };
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "MarsPath", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
