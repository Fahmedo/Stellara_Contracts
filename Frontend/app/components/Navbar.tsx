"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Academy", href: "#academy" },
  { label: "AI Assistant", href: "#ai-assistant" },
  { label: "Community", href: "#community" },
  { label: "Trade", href: "#trade" },
  { label: "News", href: "#news" },
  { label: "ABI Admin", href: "/admin/abis" },
] as const;

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-primary px-6 py-3 sm:px-8 sm:py-4">
        <Link href="/" className="text-lg font-bold text-black sm:text-xl">
          Stellara Ai
        </Link>

        <ul className="hidden items-center gap-6 md:flex lg:gap-8">
          {NAV_LINKS.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                className="text-sm font-medium text-white transition-colors hover:text-white/80"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="#connect-wallet"
          className="hidden rounded-full border border-white/20 bg-[#333] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:inline-block"
        >
          Connect Wallet
        </Link>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-black hover:text-black/70 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          )}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-6xl rounded-2xl bg-primary px-6 pb-4 md:hidden">
          <ul className="flex flex-col gap-4 py-4">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="text-sm font-medium text-white transition-colors hover:text-white/80"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="#connect-wallet"
            className="inline-block rounded-full border border-white/20 bg-[#333] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            onClick={() => setMobileMenuOpen(false)}
          >
            Connect Wallet
          </Link>
        </div>
      )}
    </header>
  );
}
