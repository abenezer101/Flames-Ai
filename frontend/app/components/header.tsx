"use client";

import Image from "next/image";
import { Flame, ArrowRight } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Header background and content */}
      <div className="w-full px-6 rounded-b-3xl border border-white/20 backdrop-blur-lg bg-white/5">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <Image src="/images/flames-logo.png" alt="Logo" width={160} height={160} />
          </div>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm text-zinc-300 hover:text-white transition-colors">
              About
            </a>
            <a href="#" className="text-sm text-zinc-300 hover:text-white transition-colors">
              GitHub
            </a>
          </nav>

          {/* CTA Button */}
          <div className="flex items-center gap-4">
            <RainbowButton className="flex items-center gap-2 group/arrow">
              Get Started
              <ArrowRight className="h-4 w-4 transition-all duration-300 group-hover/arrow:translate-x-1" />
            </RainbowButton>
          </div>
        </div>
      </div>
    </header>
  );
}
