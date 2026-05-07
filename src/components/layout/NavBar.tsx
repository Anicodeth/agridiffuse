"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PillButton } from "@/components/ui/PillButton";
import { cn } from "@/lib/utils/cn";

const links: { href: string; label: string }[] = [
  { href: "/graph", label: "Graph" },
  { href: "/simulate", label: "Simulate" },
  { href: "/metrics", label: "Metrics" },
  { href: "/neo4j", label: "Neo4j" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header
      className="bg-warm-canvas/95 sticky top-0 z-40 backdrop-blur-sm"
      style={{ boxShadow: "var(--shadow-subtle-outline)" }}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-tags bg-meadow">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
              <path
                d="M12 20 L12 12 M12 12 C8 9 6 5 7 3 C10 4 12 7 12 12 Z M12 12 C16 9 18 5 17 3 C14 4 12 7 12 12 Z"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            className="text-charcoal font-medium"
            style={{ fontSize: "15px", letterSpacing: "-0.2px" }}
          >
            AgriDiffuse
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "text-[14px] font-medium transition-colors",
                    active ? "text-charcoal" : "text-graphite hover:text-charcoal",
                  )}
                  style={{ letterSpacing: "-0.18px" }}
                >
                  {link.label}
                  {active ? (
                    <span className="bg-ember mt-0.5 block h-0.5 w-full rounded-full" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <PillButton href="/graph" variant="light" size="sm">
            Open demo
          </PillButton>
          <PillButton href="/simulate" variant="dark" size="sm">
            Run a round
          </PillButton>
        </div>
      </nav>
    </header>
  );
}
