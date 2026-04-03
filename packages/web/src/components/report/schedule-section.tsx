import type { ScheduleData } from "@creator-dna/core";

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

export function ScheduleSection({ schedule }: { schedule: ScheduleData }) {
  const bestDaySet = new Set(schedule.bestDays);

  return (
    <section className="py-16 animate-in fade-in duration-500">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        04 — Your Audience&apos;s Schedule
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-6">
        When your people are watching.
      </h2>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {ALL_DAYS.map((day) => {
          const isHot = bestDaySet.has(day) && schedule.bestDays[0] === day;
          const isWarm = bestDaySet.has(day) && !isHot;
          const bestHourForDay = isHot || isWarm ? schedule.bestHours[0] : null;

          return (
            <div
              key={day}
              className={`text-center py-3 rounded-md text-xs ${
                isHot
                  ? "bg-accent-dim text-accent"
                  : isWarm
                    ? "bg-accent-glow text-text-muted"
                    : "bg-surface text-text-faint"
              }`}
            >
              <span className="block text-[10px]">{day.slice(0, 3)}</span>
              <span className="block text-sm font-medium mt-0.5">
                {bestHourForDay !== null ? formatHour(bestHourForDay) : "\u00B7"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-text-secondary text-sm">{schedule.rationale}</p>
    </section>
  );
}
