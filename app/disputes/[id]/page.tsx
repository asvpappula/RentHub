"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiCheckCircle, FiUnlock, FiLock } from "react-icons/fi";
import type { Dispute } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatMoney, cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Input";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  under_review: "bg-secondary-50 text-secondary-700 ring-secondary-200",
  resolved: "bg-primary-50 text-primary-700 ring-primary-200",
  appealed: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { toast } = useToast();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [resolveOpen, setResolveOpen] = useState<null | "release" | "claim">(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/disputes/${id}`)
      .then((r) => r.json())
      .then((data) => setDispute(data.dispute ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!dispute || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Dispute not found</h1>
        <Link href="/disputes" className="mt-6 inline-block">
          <Button>All disputes</Button>
        </Link>
      </div>
    );
  }

  const rental = dispute.rental;
  const isOwner = rental?.owner_id === user.id;
  const isRenter = rental?.renter_id === user.id;
  const iReported = dispute.reported_by === user.id;
  const canRespond =
    !iReported && ["pending", "under_review"].includes(dispute.status) && !dispute.response;
  const canResolve = isOwner && ["pending", "under_review"].includes(dispute.status);
  const canAppeal = isRenter && dispute.status === "resolved";

  const post = async (url: string, body: object, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast("success", successMsg);
      setResolveOpen(null);
      setAppealOpen(false);
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FiAlertTriangle className="h-6 w-6 text-amber-500" />
          {dispute.dispute_type === "theft"
            ? "Theft report"
            : dispute.dispute_type === "damage"
              ? "Damage report"
              : "Dispute"}{" "}
          #{dispute.id}
        </h1>
        <Badge className={STATUS_STYLE[dispute.status]}>
          {dispute.status.replace("_", " ")}
        </Badge>
      </div>

      {rental && (
        <p className="mt-1 text-sm text-slate-500">
          On the rental of{" "}
          <Link
            href={`/rental/${rental.id}`}
            className="font-semibold text-primary-600 hover:underline"
          >
            {rental.item?.title}
          </Link>{" "}
          · deposit {formatMoney(rental.deposit_amount)} ({rental.deposit_status})
        </p>
      )}

      {/* Claim */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar
            src={dispute.reporter?.avatar_url}
            name={dispute.reporter?.name}
            size="md"
          />
          <div>
            <p className="font-semibold text-slate-900">
              {dispute.reporter?.name}
              {iReported && <span className="text-slate-400"> (you)</span>}
            </p>
            <p className="text-xs text-slate-400">
              Filed {formatDateTime(dispute.created_at)}
            </p>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm text-slate-700">
          {dispute.description}
        </p>
        {dispute.evidence_photos?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {dispute.evidence_photos.map((url) => (
              <button key={url} onClick={() => setLightbox(url)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Evidence"
                  className="h-24 w-24 rounded-xl object-cover transition hover:opacity-80"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Response */}
      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Other party&apos;s response
        </h2>
        {dispute.response ? (
          <p className="mt-3 whitespace-pre-line text-sm text-slate-700">
            {dispute.response}
          </p>
        ) : canRespond ? (
          <div className="mt-3 space-y-3">
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Share your side of the story…"
            />
            <Button
              loading={busy}
              onClick={() =>
                post(
                  `/api/disputes/${dispute.id}/respond`,
                  { response: responseText.trim() },
                  "Response added."
                )
              }
            >
              Submit response
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No response yet.</p>
        )}
      </div>

      {/* Resolution */}
      {(dispute.resolution_notes || dispute.status === "resolved" || dispute.status === "appealed") && (
        <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50/40 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-primary-800">
            <FiCheckCircle className="h-4 w-4" /> Resolution
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            {dispute.resolution_notes ?? "Resolved by the owner."}
            {dispute.resolved_at && (
              <span className="text-slate-400"> · {formatDateTime(dispute.resolved_at)}</span>
            )}
          </p>
          {dispute.status === "appealed" && (
            <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              <span className="font-semibold">Appealed:</span> {dispute.appeal_reason}
              <br />
              <span className="text-xs">RentHub support will review this case.</span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        {canResolve && (
          <>
            <Button onClick={() => setResolveOpen("release")}>
              <FiUnlock className="h-4 w-4" />
              Resolve — release deposit
            </Button>
            {rental?.deposit_status === "held" && (
              <Button variant="danger" onClick={() => setResolveOpen("claim")}>
                <FiLock className="h-4 w-4" />
                Resolve — claim deposit
              </Button>
            )}
          </>
        )}
        {canAppeal && (
          <Button variant="outline" onClick={() => setAppealOpen(true)}>
            Appeal this resolution
          </Button>
        )}
        <Link href={`/rental/${rental?.id}/agreement`}>
          <Button variant="ghost">View rental agreement</Button>
        </Link>
        <Link href={`/messages?user=${isOwner ? rental?.renter_id : rental?.owner_id}`}>
          <Button variant="ghost">Discuss in messages</Button>
        </Link>
      </div>

      {/* Resolve modal */}
      <Modal
        open={resolveOpen !== null}
        onClose={() => setResolveOpen(null)}
        title={
          resolveOpen === "claim"
            ? `Claim the ${formatMoney(rental?.deposit_amount ?? 0)} deposit?`
            : "Release the deposit?"
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResolveOpen(null)}>
              Cancel
            </Button>
            <Button
              variant={resolveOpen === "claim" ? "danger" : "primary"}
              loading={busy}
              onClick={() =>
                post(
                  `/api/disputes/${dispute.id}/resolve`,
                  { decision: resolveOpen, notes: resolveNotes.trim() || undefined },
                  resolveOpen === "claim"
                    ? "Deposit claimed — dispute resolved."
                    : "Deposit released — dispute resolved."
                )
              }
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">
          {resolveOpen === "claim"
            ? "The renter's deposit hold will be charged to cover the reported damage. The renter can appeal."
            : "The deposit hold will be released back to the renter and the dispute closed."}
        </p>
        <div className="mt-4">
          <Textarea
            value={resolveNotes}
            onChange={(e) => setResolveNotes(e.target.value)}
            placeholder="Resolution notes (optional) — shown to the other party"
          />
        </div>
      </Modal>

      {/* Appeal modal */}
      <Modal
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        title="Appeal this resolution"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAppealOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                post(
                  `/api/disputes/${dispute.id}/appeal`,
                  { reason: appealText.trim() },
                  "Appeal filed — RentHub support will review it."
                )
              }
            >
              File appeal
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">
          Explain why you believe the resolution was unfair. The case will be
          flagged for RentHub support review.
        </p>
        <div className="mt-4">
          <Textarea
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="Why are you appealing?"
          />
        </div>
      </Modal>

      {/* Evidence lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Evidence"
            className={cn("max-h-[85vh] max-w-full rounded-xl")}
          />
        </div>
      )}
    </div>
  );
}
