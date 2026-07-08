"use client";

import { useState } from "react";
import {
  FiKey,
  FiCheckCircle,
  FiCamera,
  FiX,
  FiAlertTriangle,
  FiPackage,
  FiClock,
} from "react-icons/fi";
import type { Rental, IncidentType } from "@/types";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";

const INCIDENT_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: "damage", label: "Damage" },
  { value: "missing_accessory", label: "Missing accessory" },
  { value: "missing_item", label: "Item not returned" },
  { value: "wrong_item_returned", label: "Wrong item returned" },
  { value: "late_return", label: "Late return" },
  { value: "theft_suspected", label: "Theft suspected" },
  { value: "other", label: "Other" },
];

const INCIDENT_STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  under_review: "bg-sky-50 text-sky-700 ring-sky-200",
  awaiting_evidence: "bg-amber-50 text-amber-700 ring-amber-200",
  resolved_owner: "bg-slate-100 text-slate-600 ring-slate-200",
  resolved_renter: "bg-primary-50 text-primary-700 ring-primary-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

/** Uploads photos to the PRIVATE evidence bucket; returns object paths. */
async function uploadEvidence(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch("/api/disputes/evidence", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Photo upload failed");
  return data.urls as string[];
}

function PhotoPicker({
  files,
  setFiles,
  max = 8,
}: {
  files: File[];
  setFiles: (f: File[]) => void;
  max?: number;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={URL.createObjectURL(f)}
            alt=""
            className="h-16 w-16 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => setFiles(files.filter((_, j) => j !== i))}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900/80 p-1 text-white"
            aria-label="Remove photo"
          >
            <FiX className="h-3 w-3" />
          </button>
        </div>
      ))}
      {files.length < max && (
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-300 hover:text-primary-500">
          <FiCamera className="h-5 w-5" />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (list) setFiles([...files, ...Array.from(list)].slice(0, max));
            }}
          />
        </label>
      )}
    </div>
  );
}

function EvidenceStrip({ urls, label }: { urls?: string[]; label: string }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt={`${label} ${i + 1}`}
              className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function HandoffPanel({
  rental,
  isOwner,
  isRenter,
  onDone,
}: {
  rental: Rental;
  isOwner: boolean;
  isRenter: boolean;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // pickup (owner)
  const [pickupCode, setPickupCode] = useState("");
  const [pickupPhotos, setPickupPhotos] = useState<File[]>([]);
  const [pickupNotes, setPickupNotes] = useState("");
  const accessoryNames = rental.item?.accessories ?? [];
  const [accPresent, setAccPresent] = useState<Record<string, boolean>>(
    Object.fromEntries(accessoryNames.map((n) => [n, true]))
  );

  // return (renter)
  const [returnPhotos, setReturnPhotos] = useState<File[]>([]);
  const [returnNotes, setReturnNotes] = useState("");

  // report issue (owner review) + standalone incident
  const [issueOpen, setIssueOpen] = useState<null | "review" | "standalone">(null);
  const [issueType, setIssueType] = useState<IncidentType>("damage");
  const [issueText, setIssueText] = useState("");
  const [issueFiles, setIssueFiles] = useState<File[]>([]);

  const run = async (fn: () => Promise<Response>, ok: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast("success", ok);
      onDone();
      return data;
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmPickup = async () => {
    if (!/^\d{6}$/.test(pickupCode)) {
      toast("warning", "Enter the renter's 6-digit pickup code.");
      return;
    }
    setBusy(true);
    try {
      const photos = await uploadEvidence(pickupPhotos);
      const res = await fetch(`/api/rentals/${rental.id}/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: pickupCode,
          photos,
          notes: pickupNotes || undefined,
          accessories: accessoryNames.map((n) => ({ name: n, present: accPresent[n] ?? true })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pickup failed");
      toast("success", "Pickup confirmed — the rental is now active.");
      setPickupCode("");
      setPickupPhotos([]);
      onDone();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Pickup failed");
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async () => {
    setBusy(true);
    try {
      const photos = await uploadEvidence(returnPhotos);
      const res = await fetch(`/api/rentals/${rental.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos, notes: returnNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Return failed");
      toast("success", "Return submitted — the owner will review it.");
      setReturnPhotos([]);
      onDone();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Return failed");
    } finally {
      setBusy(false);
    }
  };

  const acceptReturn = () =>
    run(
      () =>
        fetch(`/api/rentals/${rental.id}/return/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        }),
      "Return accepted — rental completed."
    );

  const submitIssue = async () => {
    if (issueText.trim().length < 10) {
      toast("warning", "Describe the issue (10+ characters).");
      return;
    }
    setBusy(true);
    try {
      const evidence = await uploadEvidence(issueFiles);
      const res =
        issueOpen === "review"
          ? await fetch(`/api/rentals/${rental.id}/return/review`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "report_issue",
                incident_type: issueType,
                description: issueText.trim(),
                evidence,
              }),
            })
          : await fetch(`/api/incidents`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rental_id: rental.id,
                type: issueType,
                description: issueText.trim(),
                evidence,
              }),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not report the issue");
      toast("success", "Issue reported — payout and deposit stay on hold until it's resolved.");
      setIssueOpen(null);
      setIssueText("");
      setIssueFiles([]);
      onDone();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not report the issue");
    } finally {
      setBusy(false);
    }
  };

  const status = rental.status;
  const returnStatus = rental.return_status ?? "none";
  const serial = rental.item?.serial_number;
  const openIncidents = (rental.incidents ?? []).filter((i) =>
    ["open", "under_review", "awaiting_evidence"].includes(i.status)
  );
  const canReportStandalone = ["confirmed", "active", "completed", "disputed"].includes(status);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Handoff
        </h2>
        {rental.is_late && (
          <Badge className="bg-rose-50 text-rose-700 ring-rose-200">
            <FiClock className="mr-1 h-3 w-3" /> Overdue
          </Badge>
        )}
      </div>

      {/* Item identifiers visible to both parties */}
      {(serial || accessoryNames.length > 0) && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          {serial && (
            <p>
              <span className="font-semibold text-slate-900">Serial / ID:</span>{" "}
              <span className="font-mono">{serial}</span>
            </p>
          )}
          {accessoryNames.length > 0 && (
            <p className="mt-1">
              <span className="font-semibold text-slate-900">Included:</span>{" "}
              {accessoryNames.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* ---- PICKUP (status confirmed) ---- */}
      {status === "confirmed" && isRenter && (
        <div className="mt-4">
          <p className="text-sm text-slate-500">
            Show this pickup code to the owner when you collect the item. They
            enter it to start the rental.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 p-4">
            <FiKey className="h-5 w-5 text-primary-600" />
            <span className="font-mono text-2xl font-bold tracking-widest text-primary-800">
              {rental.pickup_code ?? "------"}
            </span>
          </div>
        </div>
      )}

      {status === "confirmed" && isOwner && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-500">
            When you hand over the item, enter the renter&apos;s 6-digit code and
            log its condition. This starts the rental.
          </p>
          <Input
            label="Pickup code from renter"
            inputMode="numeric"
            maxLength={6}
            value={pickupCode}
            onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
          {accessoryNames.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700">Accessory checklist</p>
              <div className="mt-1.5 space-y-1">
                {accessoryNames.map((n) => (
                  <label key={n} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={accPresent[n] ?? true}
                      onChange={(e) =>
                        setAccPresent((p) => ({ ...p, [n]: e.target.checked }))
                      }
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-700">Condition photos (optional)</p>
            <PhotoPicker files={pickupPhotos} setFiles={setPickupPhotos} />
          </div>
          <Textarea
            label="Condition notes (optional)"
            value={pickupNotes}
            onChange={(e) => setPickupNotes(e.target.value)}
            placeholder="Any scratches, wear, or notes at handoff…"
          />
          <Button className="w-full" loading={busy} onClick={confirmPickup}>
            <FiCheckCircle className="h-4 w-4" /> Confirm pickup
          </Button>
        </div>
      )}

      {/* ---- RETURN (status active) ---- */}
      {status === "active" && (
        <div className="mt-4 space-y-3">
          <EvidenceStrip urls={rental.pickup_photo_urls} label="Pickup condition photos" />

          {isRenter && returnStatus !== "submitted" && (
            <>
              <p className="text-sm text-slate-500">
                Returning the item? Upload photos of its condition and submit the
                return for the owner to review.
              </p>
              <div>
                <p className="text-sm font-medium text-slate-700">Return photos</p>
                <PhotoPicker files={returnPhotos} setFiles={setReturnPhotos} />
              </div>
              <Textarea
                label="Return notes (optional)"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Anything the owner should know…"
              />
              <Button className="w-full" loading={busy} onClick={submitReturn}>
                <FiPackage className="h-4 w-4" /> Submit return
              </Button>
            </>
          )}

          {isRenter && returnStatus === "submitted" && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Return submitted — waiting for the owner to review and accept it.
            </p>
          )}

          {isOwner && (
            <>
              <p className="text-sm text-slate-500">
                {returnStatus === "submitted"
                  ? "The renter submitted the return. Review the photos, then accept it to complete the rental and release the deposit — or report an issue."
                  : "Rental is active. Once the item is back, accept the return to complete the rental and release the deposit — or report an issue."}
              </p>
              <EvidenceStrip urls={rental.return_photo_urls} label="Return condition photos" />
              {rental.return_notes && (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="font-semibold">Renter notes:</span> {rental.return_notes}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Button className="w-full" loading={busy} onClick={acceptReturn}>
                  <FiCheckCircle className="h-4 w-4" /> Accept return &amp; complete
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => setIssueOpen("review")}
                >
                  <FiAlertTriangle className="h-4 w-4 text-amber-500" /> Report an issue
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Return evidence recap once completed */}
      {status === "completed" && (
        <div className="mt-4 space-y-3">
          <EvidenceStrip urls={rental.pickup_photo_urls} label="Pickup condition photos" />
          <EvidenceStrip urls={rental.return_photo_urls} label="Return condition photos" />
        </div>
      )}

      {/* Open incidents */}
      {openIncidents.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Open issues</p>
          {openIncidents.map((i) => (
            <div key={i.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">
                  {INCIDENT_OPTIONS.find((o) => o.value === i.type)?.label ?? i.type}
                </span>
                <Badge className={INCIDENT_STATUS_STYLE[i.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}>
                  {i.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{i.description}</p>
              <EvidenceStrip urls={i.evidence_urls} label="Evidence" />
            </div>
          ))}
          <p className="text-xs text-slate-400">
            Payout and deposit release are on hold until RentHub resolves open issues.
          </p>
        </div>
      )}

      {/* Report a problem (either party) */}
      {canReportStandalone && (
        <button
          className="mt-4 text-sm font-medium text-amber-600 hover:underline"
          onClick={() => setIssueOpen("standalone")}
        >
          Report a problem with this rental
        </button>
      )}

      {/* Issue modal (review report_issue or standalone incident) */}
      <Modal
        open={issueOpen !== null}
        onClose={() => setIssueOpen(null)}
        title="Report an issue"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIssueOpen(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitIssue}>
              Report issue
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">
          Reporting an issue opens a case for RentHub review and puts the payout
          and deposit on hold until it&apos;s resolved.
        </p>
        <div className="mt-4 space-y-4">
          <Select
            label="What's the issue?"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as IncidentType)}
          >
            {INCIDENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Describe what happened"
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            placeholder="What happened, when you noticed it, and any details…"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">Evidence photos (up to 8)</p>
            <PhotoPicker files={issueFiles} setFiles={setIssueFiles} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
