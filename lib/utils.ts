import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { PriceQuote } from "@/types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, h:mm a");
}

export function rentalDays(startDate: string, endDate: string) {
  return Math.max(
    1,
    differenceInCalendarDays(parseISO(endDate), parseISO(startDate))
  );
}

export function quotePrice(
  dailyRate: number,
  depositAmount: number,
  insurancePercentage: number,
  startDate: string,
  endDate: string
): PriceQuote {
  const numberOfDays = rentalDays(startDate, endDate);
  const subtotal = dailyRate * numberOfDays;
  const insuranceFee = Math.round((subtotal * insurancePercentage) / 100);
  return {
    dailyRate,
    numberOfDays,
    subtotal,
    insuranceFee,
    depositAmount,
    total: subtotal + insuranceFee + depositAmount,
  };
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-secondary-50 text-secondary-700 ring-secondary-200",
  confirmed: "bg-primary-50 text-primary-700 ring-primary-200",
  active: "bg-primary-50 text-primary-700 ring-primary-200",
  completed: "bg-slate-100 text-slate-600 ring-slate-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
  disputed: "bg-rose-50 text-rose-700 ring-rose-200",
};
