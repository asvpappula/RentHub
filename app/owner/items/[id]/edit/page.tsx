"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiTrash2 } from "react-icons/fi";
import type { Item } from "@/types";
import { CATEGORIES } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Select, Textarea } from "@/components/ui/Input";

export default function EditItemPage({
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    category: "",
    title: "",
    description: "",
    condition: "good",
    daily_rate: "",
    deposit_amount: "",
    availability_status: "available",
    gps_tracking_required: false,
    delivery_options: "",
  });

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const it: Item | null = data.item ?? null;
        setItem(it);
        if (it) {
          setForm({
            category: it.category,
            title: it.title,
            description: it.description ?? "",
            condition: it.condition,
            daily_rate: String(it.daily_rate),
            deposit_amount: String(it.deposit_amount),
            availability_status: it.availability_status,
            gps_tracking_required: it.gps_tracking_required,
            delivery_options: it.delivery_options ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          title: form.title,
          description: form.description || undefined,
          condition: form.condition,
          daily_rate: Number(form.daily_rate),
          deposit_amount: Number(form.deposit_amount),
          availability_status: form.availability_status,
          gps_tracking_required: form.gps_tracking_required,
          delivery_options: form.delivery_options || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast("success", "Listing updated.");
      router.push("/owner/dashboard");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast("success", "Listing deleted.");
      router.push("/owner/dashboard");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!item || (user && item.owner_id !== user.id)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {item ? "This isn't your listing" : "Listing not found"}
        </h1>
        <Link href="/owner/dashboard" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Edit listing</h1>
        <Button
          variant="ghost"
          className="text-rose-600"
          onClick={() => setConfirmDelete(true)}
        >
          <FiTrash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="mt-6 space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <Select
          label="Category"
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Input
          label="Title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
        />

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Condition"
            value={form.condition}
            onChange={(e) => set("condition", e.target.value)}
          >
            <option value="new">New</option>
            <option value="like_new">Like new</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="worn">Worn</option>
          </Select>
          <Select
            label="Status"
            value={form.availability_status}
            onChange={(e) => set("availability_status", e.target.value)}
            hint="Unavailable hides it from Browse"
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Daily rate ($)"
            type="number"
            min={1}
            value={form.daily_rate}
            onChange={(e) => set("daily_rate", e.target.value)}
          />
          <Input
            label="Deposit ($)"
            type="number"
            min={0}
            value={form.deposit_amount}
            onChange={(e) => set("deposit_amount", e.target.value)}
          />
        </div>

        <Input
          label="Delivery options"
          value={form.delivery_options}
          onChange={(e) => set("delivery_options", e.target.value)}
          placeholder="Pickup, Owner drop-off"
        />

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={form.gps_tracking_required}
            onChange={(e) => set("gps_tracking_required", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-500"
          />
          <span className="text-sm font-medium text-slate-900">
            Require GPS tracking
          </span>
        </label>

        <div className="flex gap-3">
          <Button loading={saving} onClick={save} className="flex-1">
            Save changes
          </Button>
          <Link href="/owner/dashboard">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this listing?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              Delete permanently
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">
          “{item.title}” will be removed from RentHub. Listings with active or
          pending rentals can&apos;t be deleted.
        </p>
      </Modal>
    </div>
  );
}
