"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type LandingShellProps = {
  children: ReactNode;
  className?: string;
};

export function LandingShell({ children, className = "" }: LandingShellProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReducedMotion) {
        return;
      }

      const heroItems = gsap.utils.toArray<HTMLElement>(
        "[data-hero-stagger]",
        root,
      );
      if (heroItems.length > 0) {
        gsap.fromTo(
          heroItems,
          { opacity: 0, y: 44, filter: "blur(12px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.95,
            stagger: 0.12,
            delay: 0.16,
            ease: "power3.out",
          },
        );
      }

      const staggerGroups = gsap.utils.toArray<HTMLElement>(
        "[data-stagger-group]",
        root,
      );
      staggerGroups.forEach((group) => {
        const items = gsap.utils.toArray<HTMLElement>(
          "[data-stagger-item]",
          group,
        );
        if (items.length === 0) {
          return;
        }

        gsap.fromTo(
          items,
          { opacity: 0, y: 34, filter: "blur(8px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.82,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: group,
              start: "top 78%",
              once: true,
            },
          },
        );
      });

      const floatElements = gsap.utils.toArray<HTMLElement>(
        "[data-float]",
        root,
      );
      floatElements.forEach((element, index) => {
        const delta = index % 2 === 0 ? 14 : -14;
        gsap.to(element, {
          y: delta,
          duration: 4.2 + index * 0.35,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      const sheenElements = gsap.utils.toArray<HTMLElement>(
        "[data-sheen]",
        root,
      );
      sheenElements.forEach((element, index) => {
        const xShift = index % 2 === 0 ? 8 : -8;
        const yShift = index % 2 === 0 ? -10 : 10;
        gsap.to(element, {
          xPercent: xShift,
          yPercent: yShift,
          rotation: index % 2 === 0 ? 4 : -4,
          duration: 14 + index * 2.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <main
      className={`landing-main flex min-h-screen flex-col ${className}`}
      ref={rootRef}
    >
      <div className="landing-backdrop" aria-hidden="true">
        <div className="landing-mesh" />
        <div className="landing-grid" />
        <div className="landing-noise" />
        <div className="landing-orb landing-orb-one" data-sheen />
        <div className="landing-orb landing-orb-two" data-sheen />
        <div className="landing-orb landing-orb-three" data-sheen />
      </div>
      {children}
    </main>
  );
}
