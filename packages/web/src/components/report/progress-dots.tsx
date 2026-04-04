"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "niches", label: "Niches" },
  { id: "qualified", label: "Qualified" },
  { id: "ideas", label: "Ideas" },
  { id: "schedule", label: "Schedule" },
  { id: "share", label: "Share" },
];

export function ProgressDots() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = SECTIONS.map((s) => document.getElementById(s.id));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sections.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
    );

    for (const el of sections) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3"
      aria-label="Report sections"
    >
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          onClick={() =>
            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })
          }
          className="group flex items-center gap-2 justify-end"
          aria-label={s.label}
        >
          <span
            className={`text-[10px] font-[family-name:var(--font-data)] uppercase tracking-wider transition-opacity duration-200 ${
              i === active ? "text-accent opacity-100" : "text-text-faint opacity-0 group-hover:opacity-100"
            }`}
          >
            {s.label}
          </span>
          <span
            className={`block rounded-full transition-all duration-300 ${
              i === active
                ? "w-2.5 h-2.5 bg-accent"
                : "w-1.5 h-1.5 bg-border hover:bg-text-muted"
            }`}
          />
        </button>
      ))}
    </nav>
  );
}
