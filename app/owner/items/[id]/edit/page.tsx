"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiTrash2, FiStar, FiUploadCloud, FiX } from "react-icons/fi";
import type { Item, ItemPhoto } from "@/types";
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
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);

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
    serial_number: "",
    accessories: "",
  });

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const it: Item | null = data.item ?? null;
        setItem(it);
        setPhotos(it?.photos ?? []);
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
            serial_number: it.serial_number ?? "",
            accessories: (it.accessories ?? []).join(", "),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      [...files].forEach((f) => form.append("files", f));
      form.append("photo_type", photos.length === 0 ? "main" : "gallery");
      const res = await fetch(`/api/items/${id}/photos`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPhotos((prev) => [...prev, ...data.photos]);
      toast("success", `${data.photos.length} photo${data.photos.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId: number) => {
    setPhotoBusy(photoId);
    try {
      const res = await fetch(`/api/items/${id}/photos/${photoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast("success", "Photo deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPhotoBusy(null);
    }
  };

  const setMainPhoto = async (photoId: number) => {
    setPhotoBusy(photoId);
    try {
      const res = await fetch(`/api/items/${id}/photos/${photoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_type: "main" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? { ...p, photo_type: "main" }
            : p.photo_type === "main"
              ? { ...p, photo_type: "gallery" }
              : p
        )
      );
      toast("success", "Main photo updated.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setPhotoBusy(null);
    }
  };

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
          serial_number: form.serial_number || undefined,
          accessories: form.accessories.trim()
            ? form.accessories.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
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

      {/* Photos */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-sm font-semibold text-slate-700">
          Photos ({photos.length}/10)
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photo_url}
                alt="Item photo"
                className={
                  "h-24 w-24 rounded-xl object-cover ring-2 " +
                  (photo.photo_type === "main"
                    ? "ring-primary-500"
                    : "ring-transparent")
                }
              />
              {photo.photo_type === "main" && (
                <span className="absolute left-1 top-1 rounded-full bg-primary-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  MAIN
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                {photo.photo_type !== "main" ? (
                  <button
                    type="button"
                    disabled={photoBusy === photo.id}
                    onClick={() => setMainPhoto(photo.id)}
                    title="Set as main photo"
                    className="rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-primary-600"
                  >
                    <FiStar className="h-3 w-3" />
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  disabled={photoBusy === photo.id}
                  onClick={() => deletePhoto(photo.id)}
                  title="Delete photo"
                  className="rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-rose-600"
                >
                  <FiX className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {photos.length < 10 && (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-primary-300 hover:text-primary-500">
              {uploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <FiUploadCloud className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Add</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => addPhotos(e.target.files)}
              />
            </label>
          )}
        </div>
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

        <Input
          label="Serial / identifier (private)"
          value={form.serial_number}
          onChange={(e) => set("serial_number", e.target.value)}
          placeholder="e.g. SN-12345 — shown only to you, the renter, and admin"
          hint="Never shown publicly. Used to verify the exact unit at pickup/return."
        />
        <Input
          label="Included accessories"
          value={form.accessories}
          onChange={(e) => set("accessories", e.target.value)}
          placeholder="Charger, Case, Strap"
          hint="Comma-separated — becomes the pickup/return checklist."
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
