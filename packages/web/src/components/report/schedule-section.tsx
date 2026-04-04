import type { ScheduleData, CreatorDNASummary } from "@creator-dna/core";

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

interface ScheduleSectionProps {
  schedule: ScheduleData;
  dayDistribution?: Record<string, number>;
  hourDistribution?: Record<number, number>;
}

export function ScheduleSection({
  schedule,
  dayDistribution,
  hourDistribution,
}: ScheduleSectionProps) {
  // Calculate intensity for each day (0-1 range)
  const dayValues = dayDistribution
    ? ALL_DAYS.map((d) => dayDistribution[d] || 0)
    : [];
  const maxDay = Math.max(...dayValues, 1);

  // Find peak hour per day (approximation: use best hours for top days, show nothing for others)
  const bestDaySet = new Set(schedule.bestDays);

  return (
    <section id="schedule" className="py-16 animate-in fade-in duration-500">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        04 — Your Audience&apos;s Schedule
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-6">
        When your people are watching.
      </h2>

      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {ALL_DAYS.map((day, i) => {
          const intensity = dayDistribution
            ? (dayDistribution[day] || 0) / maxDay
            : bestDaySet.has(day)
              ? schedule.bestDays[0] === day
                ? 1
                : 0.6
              : 0.15;

          const isBest = bestDaySet.has(day);
          const bestHourForDay = isBest ? schedule.bestHours[0] : null;

          return (
            <div
              key={day}
              className="text-center py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: `rgba(199, 146, 83, ${intensity * 0.25})`,
                borderWidth: 1,
                borderColor: isBest
                  ? `rgba(199, 146, 83, ${intensity * 0.4})`
                  : "transparent",
              }}
            >
              <span
                className="block text-[10px] font-[family-name:var(--font-data)]"
                style={{
                  color: `rgba(199, 146, 83, ${0.4 + intensity * 0.6})`,
                }}
              >
                {day.slice(0, 3)}
              </span>
              <span
                className="block text-sm font-medium mt-0.5 font-[family-name:var(--font-data)]"
                style={{
                  color:
                    bestHourForDay !== null
                      ? `rgba(199, 146, 83, ${0.6 + intensity * 0.4})`
                      : "rgba(74, 67, 56, 0.6)",
                }}
              >
                {bestHourForDay !== null ? formatHour(bestHourForDay) : "\u00B7"}
              </span>
              {dayDistribution && (
                <span
                  className="block text-[9px] mt-0.5 font-[family-name:var(--font-data)]"
                  style={{ color: `rgba(107, 96, 88, ${0.5 + intensity * 0.5})` }}
                >
                  {dayDistribution[day]?.toLocaleString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Hour distribution bar chart */}
      {hourDistribution && (
        <div className="mb-6">
          <div className="text-[10px] font-[family-name:var(--font-data)] text-text-faint mb-2 uppercase tracking-wider">
            Activity by hour
          </div>
          <div className="flex items-end gap-px h-12">
            {Array.from({ length: 24 }, (_, h) => {
              const count = hourDistribution[h] || 0;
              const maxHour = Math.max(
                ...Object.values(hourDistribution),
                1,
              );
              const height = (count / maxHour) * 100;
              const isBestHour = schedule.bestHours.includes(h);

              return (
                <div
                  key={h}
                  className="flex-1 rounded-t-sm transition-colors"
                  style={{
                    height: `${Math.max(height, 2)}%`,
                    backgroundColor: isBestHour
                      ? `rgba(199, 146, 83, ${0.5 + (height / 100) * 0.5})`
                      : `rgba(199, 146, 83, ${0.08 + (height / 100) * 0.2})`,
                  }}
                  title={`${formatHour(h)}: ${count.toLocaleString()} videos`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] font-[family-name:var(--font-data)] text-text-faint mt-1">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </div>
      )}

      <p className="text-text-secondary text-sm">{schedule.rationale}</p>
    </section>
  );
}
