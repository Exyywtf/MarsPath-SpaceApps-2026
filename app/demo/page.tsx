import DocumentNav from "@/components/DocumentNav";
import DemoPlayer from "@/components/DemoPlayer";
import EvidenceLink from "@/components/EvidenceLink";
import PageTransition from "@/components/PageTransition";
import { demo, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/demo/", "Watch the demo — MarsPath", demo.description, true);

export default function DemoPage() {
  return <PageTransition page="demo">
    <main className="document-page demo-page page-view">
      <DocumentNav current="demo" />
      <div id="demo-player" tabIndex={-1}>
        <h1>{demo.title}</h1>
        <p className="lede">{demo.description}</p>
        <DemoPlayer />
      </div>
      <div className="demo-page-links">
        <EvidenceLink href="/?mission=jezero">Try the Jezero mission</EvidenceLink>
        <a className="evidence-link" href={demo.video} download="MarsPath_SpaceApps_2026_Demo.mp4">Download the demo</a>
      </div>
      <p className="small-note">
        Mars imagery courtesy of NASA, JPL and USGS via Mars Trek. Jezero terrain from the Mars 2020 CTX DTM
        mosaic. Published delta outcrop coordinates from Stack et al. (2020). OpenAI Codex assisted editing,
        editorial graphics and synthesis of the original score <cite>Jezero Variations</cite> and sound effects.
      </p>
      <EvidenceLink href="/sources/">Imagery, data and publications</EvidenceLink>
    </main>
  </PageTransition>;
}
