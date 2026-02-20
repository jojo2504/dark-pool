"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Menu, X } from "lucide-react";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Auctions", href: "/auctions" },
  { label: "Create", href: "/auctions/create" },
  { label: "Debug Contracts", href: "/debug" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:bg-cyan-500/30 transition-all">
            <Lock className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-white font-semibold text-sm tracking-wide hidden sm:inline">Dark Pool</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${pathname === link.href ? "text-cyan-400 font-medium" : "text-zinc-400 hover:text-zinc-200"
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <RainbowKitCustomConnectButton />

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(p => !p)}
            className="md:hidden p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-white/[0.06]">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block py-2.5 text-sm rounded-lg px-3 transition-colors ${pathname === link.href
                    ? "text-cyan-400 bg-cyan-500/10"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
