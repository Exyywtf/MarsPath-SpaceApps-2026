import Link from "next/link";
import HeaderLinks from "./HeaderLinks";

export default function DocumentNav({ current }: { current: "sources" | "methodology" }) {
  return (
    <nav className="document-nav" aria-label="MarsPath pages">
      <Link className="brand" href="/" aria-label="MarsPath home">
        <span className="brand-orbit" aria-hidden="true" />
        MarsPath
      </Link>
      <Link href="/">Explorer</Link>
      <HeaderLinks current={current} />
    </nav>
  );
}
