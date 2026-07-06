"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiUploadCloud, FiX } from "react-icons/fi";
import { CATEGORIES } from "@/types";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea, FieldWrapper } from "@/components/ui/Input";

const formSchema = z.object({
  category: z.string().min(1, "Pick a category"),
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().max(5000).optional(),
  condition: z.enum(["new", "like_new", "good", "fair", "worn"]),
  daily_rate: z.coerce.number<number>().int().positive("Enter a daily rate"),
  deposit_amount: z.coerce.number<number>().int().min(0, "Deposit can be 0 or more"),
  delivery_pickup: z.boolean(),
  delivery_dropoff: z.boolean(),
  gps_tracking_required: z.boolean(),
  rules: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ListItemPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      condition: "good",
      delivery_pickup: true,
      delivery_dropoff: false,
      gps_tracking_required: false,
    },
  });

  const [dragging, setDragging] = useState(false);

  const addFiles = (list: FileList | DataTransferItemList | File[] | null) => {
    if (!list) return;
    const incoming =
      list instanceof DataTransferItemList
        ? [...list].map((i) => i.getAsFile()).filter((f): f is File => !!f)
        : [...list];
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length < incoming.length) {
      toast("warning", "Only image files can be uploaded.");
    }
    setFiles((prev) => [...prev, ...images].slice(0, 10));
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const delivery = [
        values.delivery_pickup && "Pickup",
        values.delivery_dropoff && "Owner drop-off",
      ]
        .filter(Boolean)
        .join(", ");

      const description = values.rules
        ? `${values.description ?? ""}\n\nRules & guidelines:\n${values.rules}`.trim()
        : values.description;

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: values.category,
          title: values.title,
          description,
          condition: values.condition,
          daily_rate: values.daily_rate,
          deposit_amount: values.deposit_amount,
          gps_tracking_required: values.gps_tracking_required,
          delivery_options: delivery || "Pickup",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create listing");

      if (files.length > 0) {
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        form.append("photo_type", "main");
        const photoRes = await fetch(`/api/items/${data.item.id}/photos`, {
          method: "POST",
          body: form,
        });
        if (!photoRes.ok) {
          toast("warning", "Listing created, but photos failed to upload.");
        }
      }

      toast("success", "Your item is live! 🎉");
      router.push(`/item/${data.item.id}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">List an item</h1>
      <p className="mt-1 text-sm text-slate-500">
        The average item earns its owner $75–$300 per month.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8"
      >
        <Select label="Category" error={errors.category?.message} {...register("category")}>
          <option value="">Choose a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        {/* Photos */}
        <FieldWrapper
          label="Photos (up to 10)"
          hint="Clear, well-lit photos rent 3× faster."
        >
          <div>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition " +
                (dragging
                  ? "border-primary-500 bg-primary-50/60"
                  : "border-slate-200 bg-slate-50/60 hover:border-primary-300 hover:bg-primary-50/30")
              }
            >
              <FiUploadCloud className="h-7 w-7 text-slate-400" />
              <span className="text-sm text-slate-500">
                {dragging
                  ? "Drop images to add them"
                  : "Click to upload, or drag & drop images"}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900/80 p-1 text-white"
                      aria-label="Remove photo"
                    >
                      <FiX className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FieldWrapper>

        <Input
          label="Title"
          placeholder='e.g. "DeWalt 20V cordless drill kit"'
          error={errors.title?.message}
          {...register("title")}
        />

        <Textarea
          label="Description"
          placeholder="What is it, what's included, what shape is it in?"
          error={errors.description?.message}
          {...register("description")}
        />

        <Select label="Condition" error={errors.condition?.message} {...register("condition")}>
          <option value="new">New</option>
          <option value="like_new">Like new</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="worn">Worn</option>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Daily rate ($)"
            type="number"
            min={1}
            placeholder="25"
            error={errors.daily_rate?.message}
            {...register("daily_rate")}
          />
          <Input
            label="Deposit ($)"
            type="number"
            min={0}
            placeholder="100"
            hint="Held in escrow, refunded after return"
            error={errors.deposit_amount?.message}
            {...register("deposit_amount")}
          />
        </div>

        <FieldWrapper label="Delivery options">
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                {...register("delivery_pickup")}
              />
              Renter picks up
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                {...register("delivery_dropoff")}
              />
              I can drop it off
            </label>
          </div>
        </FieldWrapper>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-500"
            {...register("gps_tracking_required")}
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              Require GPS tracking
            </span>
            <span className="text-xs text-slate-500">
              Recommended for items worth $500+. Renters agree to a tracker
              during the rental.
            </span>
          </span>
        </label>

        <Textarea
          label="Rules & guidelines (optional)"
          placeholder="e.g. Return with a full battery. No use in rain."
          error={errors.rules?.message}
          {...register("rules")}
        />

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          List item
        </Button>
      </form>
    </div>
  );
}
