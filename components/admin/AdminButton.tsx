"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface AdminButtonProps {
  endpoint: string;
  body: Record<string, unknown>;
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  /** Prompt for a required reason before sending. */
  promptReason?: boolean;
  confirm?: string;
  onDone?: () => void;
}

/** POSTs an admin action with an optional reason prompt; refreshes on success. */
export default function AdminButton({
  endpoint,
  body,
  label,
  variant = "outline",
  promptReason,
  confirm,
  onDone,
}: AdminButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    let reason: string | undefined;
    if (promptReason) {
      const r = window.prompt(`Reason for "${label}"?`);
      if (r === null) return; // cancelled
      reason = r;
    }
    if (confirm && !window.confirm(confirm)) return;

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason !== undefined ? { ...body, reason } : body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast("success", `${label} done.`);
      onDone?.();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant={variant} loading={busy} onClick={run}>
      {label}
    </Button>
  );
}
