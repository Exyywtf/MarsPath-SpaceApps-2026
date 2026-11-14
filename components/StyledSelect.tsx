import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export default function StyledSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className={"styled-select " + className}>
    <select {...props} /><ChevronDown size={16} aria-hidden="true" />
  </span>;
}
