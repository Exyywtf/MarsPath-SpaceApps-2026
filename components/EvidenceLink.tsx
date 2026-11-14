import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Children, type AnchorHTMLAttributes, type ReactNode } from "react";

function labelWithIcon(children: ReactNode) {
  const parts = Children.toArray(children);
  const last = parts.pop();
  if (typeof last === "string") {
    const text = last.replace(/\s*↗\s*$/, "").trimEnd(), split = text.lastIndexOf(" ");
    return <>{parts}{split >= 0 ? text.slice(0, split + 1) : ""}<span className="evidence-tail">
      {text.slice(split + 1)}<ArrowUpRight size={15} aria-hidden="true" />
    </span></>;
  }
  return <>{parts}<span className="evidence-tail">{last}<ArrowUpRight size={15} aria-hidden="true" /></span></>;
}

export default function EvidenceLink({ children, className = "", href = "", compactLabel, ...props }:
  AnchorHTMLAttributes<HTMLAnchorElement> & { compactLabel?: string }) {
  const content = compactLabel ? <><span className="evidence-full">{labelWithIcon(children)}</span>
    <span className="evidence-compact">{labelWithIcon(compactLabel)}</span></> : labelWithIcon(children);
  const styling = "evidence-link " + className;
  return href.startsWith("/")
    ? <Link href={href} {...props} className={styling}>{content}</Link>
    : <a href={href} {...props} className={styling}>{content}</a>;
}
