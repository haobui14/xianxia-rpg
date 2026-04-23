"use client";

import { useState, ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  /** Extra text/badge displayed inline next to the title */
  badge?: ReactNode;
  /** Whether the section starts expanded (default: true) */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`bg-xianxia-dark border border-xianxia-accent/30 rounded-lg overflow-hidden ${className}`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 pb-4 text-left hover:bg-xianxia-accent/5 transition-colors group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-xianxia-gold">{title}</h2>
          {badge && <span className="text-sm text-gray-400">{badge}</span>}
        </div>
        <span
          className={`text-xianxia-accent transition-transform duration-200 text-lg ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        >
          ▼
        </span>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
