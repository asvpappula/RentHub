import Link from "next/link";
import { FiImage, FiCalendar, FiClock } from "react-icons/fi";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Rental } from "@/types";
import { formatDate, formatMoney, STATUS_STYLES } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";

export default function RentalCard({
  rental,
  perspective,
}: {
  rental: Rental;
  perspective: "renter" | "owner";
}) {
  const photo =
    rental.item?.photos?.find((p) => p.photo_type === "main") ??
    rental.item?.photos?.[0];
  const counterpart = perspective === "renter" ? rental.owner : rental.renter;

  return (
    <Link
      href={`/rental/${rental.id}`}
      className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-primary-200"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.photo_url}
            alt={rental.item?.title ?? "Rental item"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <FiImage className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-slate-900">
            {rental.item?.title ?? `Rental #${rental.id}`}
          </h3>
          <Badge className={STATUS_STYLES[rental.status]}>{rental.status}</Badge>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <FiCalendar className="h-3.5 w-3.5" />
          {formatDate(rental.start_date)} → {formatDate(rental.end_date)}
          {["confirmed", "active"].includes(rental.status) &&
            (() => {
              const daysLeft = differenceInCalendarDays(
                parseISO(rental.end_date),
                new Date()
              );
              return (
                <span
                  className={
                    "ml-1 inline-flex items-center gap-1 font-medium " +
                    (daysLeft < 0 ? "text-rose-600" : "text-primary-700")
                  }
                >
                  <FiClock className="h-3 w-3" />
                  {daysLeft > 0
                    ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                    : daysLeft === 0
                      ? "due back today"
                      : `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`}
                </span>
              );
            })()}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">
            {formatMoney(rental.total_cost)}
          </span>
          {counterpart && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Avatar
                src={counterpart.avatar_url}
                name={counterpart.name}
                size="sm"
                className="h-6 w-6 text-[10px]"
              />
              {perspective === "renter" ? "from" : "to"} {counterpart.name}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
