"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Waves } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/auctions", label: "Auctions" },
  { href: "/auctions/create", label: "Create" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* Frosted glass bar */}
      <div className="mx-4 mt-4 rounded-2xl border border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl shadow-lg shadow-black/50">
        <div className="flex h-14 items-center justify-between px-5">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
              <Waves className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="text-white">dark</span>
              <span className="text-cyan-400">pool</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    active
                      ? "text-cyan-400"
                      : "text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Wallet */}
          <WalletButton />
        </div>
      </div>
    </motion.header>
  );
}
