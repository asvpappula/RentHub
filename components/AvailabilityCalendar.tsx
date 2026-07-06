"use client";

import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";

interface BookedRange {
  start_date: string;
  end_date: string;
}

interface AvailabilityCalendarProps {
  booked: BookedRange[];
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  months?: number;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function AvailabilityCalendar({
  booked,
  startDate,
  endDate,
  onChange,
  months = 3,
}: AvailabilityCalendarProps) {
  const today = format(new Date(), "yyyy-MM-dd");

  const isBooked = useMemo(() => {
    return (day: string) =>
      booked.some((r) => day >= r.start_date && day <= r.end_date);
  }, [booked]);

  const rangeHasBookedDay = (from: string, to: string) =>
    booked.some((r) => r.start_date <= to && r.end_date >= from);

  const handleClick = (day: string) => {
    if (day < today || isBooked(day)) return;
    // First click (or restarting a completed/invalid selection) sets the start.
    if (!startDate || (startDate && endDate) || day <= startDate) {
      onChange(day, "");
      return;
    }
    // Second click sets the end, unless a booked day falls inside the range.
    if (rangeHasBookedDay(startDate, day)) {
      onChange(day, "");
      return;
    }
    onChange(startDate, day);
  };

  const monthBlocks = Array.from({ length: months }, (_, i) => {
    const monthStart = startOfMonth(addMonths(new Date(), i));
    const days = eachDayOfInterval({
      start: monthStart,
      end: endOfMonth(monthStart),
    });
    return { monthStart, days };
  });

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {monthBlocks.map(({ monthStart, days }) => (
        <div key={monthStart.toISOString()}>
          <h3 className="mb-2 text-center text-sm font-semibold text-slate-700">
            {format(monthStart, "MMMM yyyy")}
          </h3>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="text-[11px] font-medium text-slate-400">
                {d}
              </span>
            ))}
            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const day = format(d, "yyyy-MM-dd");
              const past = isBefore(d, startOfDay(new Date()));
              const bookedDay = isBooked(day);
              const selected =
                (startDate && day === startDate) ||
                (startDate && endDate && day >= startDate && day <= endDate);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past || bookedDay}
                  onClick={() => handleClick(day)}
                  title={
                    bookedDay ? "Booked" : past ? "" : "Available — click to select"
                  }
                  className={cn(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition",
                    past && "text-slate-300",
                    bookedDay &&
                      !past &&
                      "bg-rose-50 text-rose-400 line-through cursor-not-allowed",
                    !past && !bookedDay && !selected &&
                      "text-slate-700 hover:bg-primary-100",
                    selected && "bg-primary-500 font-semibold text-white"
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="col-span-full flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary-500" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-100 ring-1 ring-rose-200" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-white ring-1 ring-slate-200" /> Available
        </span>
      </div>
    </div>
  );
}
