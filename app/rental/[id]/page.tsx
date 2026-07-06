"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  FiImage,
  FiAlertTriangle,
  FiCheckCircle,
  FiMessageSquare,
  FiCreditCard,
  FiUnlock,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useRentalUpdates } from "@/hooks/useRentalUpdates";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatMoney, STATUS_STYLES } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import RatingStars from "@/components/RatingStars";
import PriceBreakdown from "@/components/PriceBreakdown";
import { Textarea } from "@/components/ui/Input";

export default function RentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { rental, loading, refetch } = useRentalUpdates(Number(id));

  const [disputeOpen, setDisputeOpen] = useState<null | "damage" | "theft">(null);
  const [disputeText, setDisputeText] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [myRating, setMyRating] = useState(0);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!rental || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Rental not found</h1>
        <Link href="/dashboard" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const isOwner = rental.owner_id === user.id;
  const isRenter = rental.renter_id === user.id;
  const counterpart = isOwner ? rental.renter : rental.owner;
  const photo = rental.item?.photos?.[0];

  const daysLeft = differenceInCalendarDays(parseISO(rental.end_date), new Date());

  const quote = {
    dailyRate: rental.daily_rate,
    numberOfDays: rental.number_of_days,
    subtotal: rental.daily_rate * rental.number_of_days,
    insuranceFee: rental.insurance_fee,
    depositAmount: rental.deposit_amount,
    total: rental.total_cost,
  };

  const act = async (fn: () => Promise<Response>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast("success", successMsg);
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const completeRental = () =>
    act(
      () => fetch(`/api/rentals/${rental.id}/complete`, { method: "POST" }),
      "Rental marked complete."
    );

  /** Owner path: complete the rental AND release the deposit hold. */
  const completeAndRelease = async () => {
    setBusy(true);
    try {
      const completeRes = await fetch(`/api/rentals/${rental.id}/complete`, {
        method: "POST",
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error ?? "Completion failed");

      if (rental.deposit_status === "held") {
        const refundRes = await fetch("/api/payments/refund-deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rental_id: rental.id }),
        });
        const refundData = await refundRes.json();
        if (!refundRes.ok) throw new Error(refundData.error ?? "Deposit release failed");
        toast("success", "Rental completed — deposit released to the renter.");
      } else {
        toast("success", "Rental completed.");
      }
      setCompleteOpen(false);
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const refundDeposit = () =>
    act(
      () =>
        fetch("/api/payments/refund-deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rental_id: rental.id }),
        }),
      "Deposit released to the renter."
    );

  const submitDispute = async () => {
    if (disputeText.trim().length < 10) {
      toast("warning", "Please describe what happened (10+ characters).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rental_id: rental.id,
          dispute_type: disputeOpen,
          description: disputeText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not file report");
      toast("success", "Report filed. Our team will review it within 24h.");
      setDisputeOpen(null);
      setDisputeText("");
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not file report");
    } finally {
      setBusy(false);
    }
  };

  const submitRating = (value: number) => {
    setMyRating(value);
    act(
      () =>
        fetch(`/api/rentals/${rental.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isRenter ? { owner_rating: value } : { renter_rating: value }
          ),
        }),
      "Thanks for your rating!"
    );
  };

  const alreadyRated = isRenter
    ? rental.owner_rating != null
    : rental.renter_rating != null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Rental #{rental.id}</h1>
        <Badge className={STATUS_STYLES[rental.status]}>{rental.status}</Badge>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          {/* Item */}
          <div className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <Link
              href={`/item/${rental.item_id}`}
              className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.photo_url}
                  alt={rental.item?.title ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <FiImage className="h-8 w-8" />
                </div>
              )}
            </Link>
            <div>
              <Link
                href={`/item/${rental.item_id}`}
                className="font-semibold text-slate-900 hover:text-primary-700"
              >
                {rental.item?.title}
              </Link>
              <p className="mt-1 text-sm text-slate-500">
                {formatDate(rental.start_date)} → {formatDate(rental.end_date)}
              </p>
              {["confirmed", "active"].includes(rental.status) && (
                <p className="mt-1 text-sm font-medium text-primary-700">
                  {daysLeft > 0
                    ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`
                    : daysLeft === 0
                      ? "Due back today"
                      : `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`}
                </p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Timeline
            </h2>
            <ol className="mt-4 space-y-3">
              {[
                { label: "Requested", done: true },
                {
                  label: "Owner approved",
                  done: !["pending", "rejected", "cancelled"].includes(rental.status),
                },
                {
                  label: "Paid & confirmed",
                  done: ["confirmed", "active", "completed", "disputed"].includes(rental.status),
                },
                {
                  label: "Completed",
                  done: rental.status === "completed",
                },
                ...(rental.deposit_amount > 0
                  ? [
                      {
                        label:
                          rental.deposit_status === "claimed"
                            ? "Deposit claimed"
                            : "Deposit released",
                        done: ["refunded", "claimed"].includes(rental.deposit_status),
                      },
                    ]
                  : []),
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      s.done ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-300"
                    }`}
                  >
                    <FiCheckCircle className="h-3 w-3" />
                  </span>
                  <span className={s.done ? "text-slate-900" : "text-slate-400"}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Price */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Price breakdown
            </h2>
            <PriceBreakdown quote={quote} />
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              Deposit status:
              <Badge
                className={
                  rental.deposit_status === "held"
                    ? "bg-secondary-50 text-secondary-700 ring-secondary-200"
                    : rental.deposit_status === "refunded"
                      ? "bg-primary-50 text-primary-700 ring-primary-200"
                      : rental.deposit_status === "claimed"
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                }
              >
                {rental.deposit_status}
              </Badge>
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 md:col-span-2">
          {/* Counterpart */}
          {counterpart && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {isOwner ? "Renter" : "Owner"}
              </h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar src={counterpart.avatar_url} name={counterpart.name} size="md" />
                <div>
                  <p className="font-semibold text-slate-900">{counterpart.name}</p>
                  {counterpart.average_rating != null && (
                    <RatingStars rating={Number(counterpart.average_rating)} />
                  )}
                </div>
              </div>
              <Link href={`/messages?user=${counterpart.id}`} className="mt-4 block">
                <Button variant="outline" size="sm" className="w-full">
                  <FiMessageSquare className="h-4 w-4" />
                  Message
                </Button>
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Actions
            </h2>

            {isRenter && rental.status === "approved" && (
              <Button
                className="w-full"
                onClick={() => router.push(`/checkout/${rental.id}`)}
              >
                <FiCreditCard className="h-4 w-4" />
                Pay & confirm
              </Button>
            )}

            {["confirmed", "active"].includes(rental.status) && (
              <Button
                className="w-full"
                loading={busy && !completeOpen}
                onClick={() => (isOwner ? setCompleteOpen(true) : completeRental())}
              >
                <FiCheckCircle className="h-4 w-4" />
                Complete rental
              </Button>
            )}

            {isOwner &&
              rental.status === "completed" &&
              rental.deposit_status === "held" && (
                <Button
                  className="w-full"
                  variant="secondary"
                  loading={busy}
                  onClick={refundDeposit}
                >
                  <FiUnlock className="h-4 w-4" />
                  Release deposit
                </Button>
              )}

            {["confirmed", "active", "completed"].includes(rental.status) && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDisputeOpen("damage")}
                >
                  <FiAlertTriangle className="h-4 w-4 text-amber-500" />
                  Report damage
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDisputeOpen("theft")}
                >
                  <FiAlertTriangle className="h-4 w-4 text-rose-500" />
                  Report theft
                </Button>
              </>
            )}

            {isRenter && ["pending", "approved"].includes(rental.status) && (
              <Button
                variant="ghost"
                className="w-full text-rose-600"
                loading={busy}
                onClick={() =>
                  act(
                    () =>
                      fetch(`/api/rentals/${rental.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "cancelled" }),
                      }),
                    "Rental cancelled."
                  )
                }
              >
                Cancel request
              </Button>
            )}
          </div>

          {/* Rating */}
          {rental.status === "completed" && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Rate the {isOwner ? "renter" : "owner"}
              </h2>
              <div className="mt-3">
                {alreadyRated ? (
                  <p className="text-sm text-primary-700">
                    ✓ You rated this rental{" "}
                    {isRenter ? rental.owner_rating : rental.renter_rating}/5
                  </p>
                ) : (
                  <RatingStars
                    rating={myRating || null}
                    size="md"
                    interactive
                    onChange={submitRating}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Owner completion modal */}
      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete this rental?"
        size="sm"
      >
        <p className="text-sm text-slate-500">
          Was &ldquo;{rental.item?.title}&rdquo; returned in good condition?
        </p>
        <div className="mt-5 space-y-2.5">
          <Button className="w-full" loading={busy} onClick={completeAndRelease}>
            <FiCheckCircle className="h-4 w-4" />
            {rental.deposit_status === "held"
              ? `Yes — complete & release ${formatMoney(rental.deposit_amount)} deposit`
              : "Yes — complete rental"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setCompleteOpen(false);
              setDisputeOpen("damage");
            }}
          >
            <FiAlertTriangle className="h-4 w-4 text-amber-500" />
            No — report damage
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Reporting damage opens a dispute; the deposit stays held until it&apos;s
          resolved.
        </p>
      </Modal>

      {/* Dispute modal */}
      <Modal
        open={disputeOpen !== null}
        onClose={() => setDisputeOpen(null)}
        title={disputeOpen === "theft" ? "Report theft" : "Report damage"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDisputeOpen(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitDispute}>
              File report
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">
          {disputeOpen === "theft"
            ? "If the item was not returned or was stolen, describe what happened. For theft we recommend also filing a police report — the insurance claim will need it."
            : "Describe the damage. Include when you noticed it and photos if possible (you can attach them in messages)."}
        </p>
        <div className="mt-4">
          <Textarea
            value={disputeText}
            onChange={(e) => setDisputeText(e.target.value)}
            placeholder="What happened?"
          />
        </div>
      </Modal>
    </div>
  );
}
