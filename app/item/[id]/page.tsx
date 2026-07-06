"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import {
  FiChevronLeft,
  FiChevronRight,
  FiImage,
  FiMessageSquare,
  FiEye,
  FiRepeat,
} from "react-icons/fi";
import type { Item } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { quotePrice, formatMoney, formatDate, CONDITION_LABELS } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import RatingStars from "@/components/RatingStars";
import TrustBadge from "@/components/TrustBadge";
import PriceBreakdown from "@/components/PriceBreakdown";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"));
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((data) => setItem(data.item ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  const quote = useMemo(() => {
    if (!item || !startDate || !endDate || endDate <= startDate) return null;
    return quotePrice(
      item.daily_rate,
      item.deposit_amount,
      Number(item.insurance_fee_percentage),
      startDate,
      endDate
    );
  }, [item, startDate, endDate]);

  const requestRental = async () => {
    if (!user) {
      router.push(`/login?next=/item/${id}`);
      return;
    }
    if (!quote) {
      toast("warning", "Pick valid rental dates first.");
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: Number(id),
          start_date: startDate,
          end_date: endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      toast("success", "Request sent! The owner will review it shortly.");
      router.push(`/rental/${data.rental.id}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Request failed");
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Item not found</h1>
        <p className="mt-2 text-slate-500">
          This listing may have been removed by its owner.
        </p>
        <Link href="/browse" className="mt-6 inline-block">
          <Button>Browse other items</Button>
        </Link>
      </div>
    );
  }

  const photos = item.photos ?? [];
  const photo = photos[photoIndex];
  const isOwner = user?.id === item.owner_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: gallery + details */}
        <div className="lg:col-span-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.photo_url}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-300">
                <FiImage className="h-16 w-16" />
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                  aria-label="Previous photo"
                >
                  <FiChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                  aria-label="Next photo"
                >
                  <FiChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === photoIndex ? "w-5 bg-white" : "w-1.5 bg-white/60"
                      }`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {item.category}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Condition: {CONDITION_LABELS[item.condition] ?? item.condition}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <FiEye className="h-3.5 w-3.5" /> {item.view_count} views
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <FiRepeat className="h-3.5 w-3.5" /> {item.rental_count} rentals
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">{item.title}</h1>
            {item.average_rating != null && (
              <div className="mt-2">
                <RatingStars rating={Number(item.average_rating)} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <TrustBadge kind="insurance" label={`Insured (${item.insurance_fee_percentage}% fee)`} />
              <TrustBadge kind="deposit" label={`${formatMoney(item.deposit_amount)} deposit`} />
              {item.gps_tracking_required && <TrustBadge kind="gps" />}
            </div>

            {item.description && (
              <p className="mt-5 whitespace-pre-line leading-relaxed text-slate-600">
                {item.description}
              </p>
            )}

            {item.delivery_options && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Delivery: </span>
                {item.delivery_options}
              </div>
            )}
          </div>

          {/* Owner card */}
          {item.owner && (
            <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Listed by
              </h2>
              <div className="mt-3 flex items-center gap-4">
                <Avatar src={item.owner.avatar_url} name={item.owner.name} size="lg" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{item.owner.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {item.owner.average_rating != null && (
                      <RatingStars
                        rating={Number(item.owner.average_rating)}
                        reviewCount={item.owner.total_reviews}
                      />
                    )}
                    <span className="text-xs text-slate-400">
                      Member since {formatDate(item.owner.created_at)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {item.owner.id_verified && <TrustBadge kind="id_verified" />}
                    {item.owner.phone_verified && <TrustBadge kind="phone_verified" />}
                  </div>
                </div>
                {!isOwner && (
                  <Link href={user ? `/messages?user=${item.owner.id}` : "/login"}>
                    <Button variant="outline" size="sm">
                      <FiMessageSquare className="h-4 w-4" />
                      Message
                    </Button>
                  </Link>
                )}
              </div>
              {item.owner.bio && (
                <p className="mt-4 text-sm text-slate-500">{item.owner.bio}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: booking card */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p>
              <span className="text-3xl font-extrabold text-slate-900">
                {formatMoney(item.daily_rate)}
              </span>
              <span className="text-slate-500">/day</span>
            </p>

            {isOwner ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                This is your listing. Manage it from your{" "}
                <Link href="/owner/dashboard" className="font-semibold text-primary-600">
                  owner dashboard
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">From</label>
                    <input
                      type="date"
                      value={startDate}
                      min={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">To</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                {quote && (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <PriceBreakdown quote={quote} />
                  </div>
                )}

                <Button
                  className="mt-5 w-full"
                  size="lg"
                  loading={requesting}
                  disabled={item.availability_status !== "available"}
                  onClick={requestRental}
                >
                  {item.availability_status === "available"
                    ? "Request to rent"
                    : "Currently unavailable"}
                </Button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  You won&apos;t be charged until the owner approves.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
