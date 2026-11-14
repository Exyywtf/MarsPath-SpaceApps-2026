import Link from "next/link";

export default function DocumentNav({ current }: { current: "sources" | "methodology" }) {
  return (
    <nav className="document-nav" aria-label="MarsPath pages">
      <Link className="brand" href="/" aria-label="MarsPath home">
        <span className="brand-orbit" aria-hidden="true" />
        MarsPath
      </Link>
      <Link href="/">Explorer</Link>
      <Link href="/sources/" aria-current={current === "sources" ? "page" : undefined}>Sources</Link>
      <Link href="/methodology/" aria-current={current === "methodology" ? "page" : undefined}>Methodology</Link>
    </nav>
  );
}
