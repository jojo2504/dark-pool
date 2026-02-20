"use client";

import Link from "next/link";

const navLinks = [
  { label: "Auctions", href: "/auctions" },
  { label: "Create", href: "/auctions/create" },
  { label: "Debug", href: "/debug" },
];

export function FooterSection() {
  return (
    <footer className="border-t border-white bg-black px-6">
      <div className="max-w-5xl mx-auto">
        {/* Main row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-10 gap-8">
          {/* Brand */}
          <div>
            <p className="font-mono text-sm font-bold tracking-[0.1em] uppercase text-white mb-2">DARK POOL</p>
            <p className="font-mono text-[11px] text-white opacity-30 max-w-[280px] leading-relaxed">
              Sealed-bid auctions with cryptographic fairness. Immutable rules. Trustless on-chain settlement.
            </p>
          </div>

          {/* Links */}
          <nav className="flex gap-0 border border-white">
            {navLinks.map(l => (
              <Link
                key={l.label}
                href={l.href}
                className="px-5 py-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-white border-r border-white last:border-r-0 hover:opacity-60 transition-all duration-100"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom */}
        <div className="border-t border-white py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-white opacity-20">
            © {new Date().getFullYear()} DARK POOL
          </p>
          <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-white opacity-20">
            EVM COMPATIBLE — COMMIT-REVEAL PROTOCOL
          </p>
        </div>
      </div>
    </footer>
  );
}
