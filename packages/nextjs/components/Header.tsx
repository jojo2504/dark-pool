"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { GoArrowUpRight } from "react-icons/go";
import { OGStatusWidget } from "~~/components/ai/OGStatusWidget";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import "~~/styles/CardNav.css";

const NAV_ITEMS = [
  {
    label: "Auctions",
    links: [
      { label: "Browse All", href: "/auctions", ariaLabel: "Browse all auctions" },
      { label: "Create New", href: "/auctions/create", ariaLabel: "Create a new auction" },
      { label: "My Auctions", href: "/auctions/my-auctions", ariaLabel: "Manage your auctions" },
    ],
  },
  {
    label: "Compliance",
    links: [
      { label: "KYB Verification", href: "/kyb", ariaLabel: "KYB institutional verification" },
      { label: "How It Works", href: "/#how-it-works", ariaLabel: "How the protocol works" },
    ],
  },
  {
    label: "Developer",
    links: [
      { label: "Debug Contracts", href: "/debug", ariaLabel: "Debug contracts" },
      { label: "Block Explorer", href: "/blockexplorer", ariaLabel: "Block explorer" },
    ],
  },
];

export function Header() {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 220;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const contentEl = navEl.querySelector(".card-nav-content") as HTMLElement;
      if (contentEl) {
        const wasVisibility = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = "visible";
        contentEl.style.pointerEvents = "auto";
        contentEl.style.position = "static";
        contentEl.style.height = "auto";
        void contentEl.offsetHeight;

        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisibility;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return 56 + contentHeight + 8;
      }
    }
    return 220;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 56, overflow: "hidden" });
    gsap.set(cardsRef.current, { y: 30, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight, duration: 0.3, ease: "power2.out" });
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.3, ease: "power2.out", stagger: 0.05 }, "-=0.1");
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      if (isExpanded) {
        gsap.set(navRef.current, { height: calculateHeight() });
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) tlRef.current = newTl;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const closeMenu = () => {
    setIsHamburgerOpen(false);
    tlRef.current?.eventCallback("onReverseComplete", () => setIsExpanded(false));
    tlRef.current?.reverse();
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className="card-nav-container">
      <nav ref={navRef} className={`card-nav ${isExpanded ? "open" : ""}`}>
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? "open" : ""}`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? "Close menu" : "Open menu"}
            tabIndex={0}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div className="logo-container">
            <Link href="/" className="logo-text" style={{ textDecoration: "none" }}>
              DARK POOL
            </Link>
            <OGStatusWidget />
          </div>

          <div className="card-nav-cta-button">
            <RainbowKitCustomConnectButton />
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {NAV_ITEMS.map((item, idx) => (
            <div key={item.label} className="nav-card" ref={setCardRef(idx)}>
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {item.links.map((lnk, i) => (
                  <Link
                    key={`${lnk.label}-${i}`}
                    className="nav-card-link"
                    href={lnk.href}
                    aria-label={lnk.ariaLabel}
                    onClick={closeMenu}
                  >
                    <GoArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
                    {lnk.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
