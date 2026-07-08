import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.literal(true, {
    error: "You must accept the Terms of Service",
  }),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
  email: z.email("Enter a valid email"),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  bio: z.string().max(2000).optional(),
  phone_number: z.string().max(20).optional(),
  avatar_url: z.url().max(500).optional(),
});

export const createItemSchema = z.object({
  category: z.string().min(1).max(100),
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().max(5000).optional(),
  condition: z.enum(["new", "like_new", "good", "fair", "worn"]).default("good"),
  daily_rate: z.number().int().positive("Daily rate must be positive").max(100_000),
  deposit_amount: z.number().int().min(0).max(1_000_000),
  insurance_fee_percentage: z.number().min(0).max(9.99).default(5),
  gps_tracking_required: z.boolean().default(false),
  delivery_options: z.string().max(255).optional(),
  // Phase 4: private serial/identifier + accessory checklist (both optional).
  serial_number: z.string().max(120).optional(),
  accessories: z.array(z.string().min(1).max(120)).max(30).optional(),
});

export const updateItemSchema = createItemSchema.partial().extend({
  availability_status: z.enum(["available", "rented", "unavailable"]).optional(),
});

export const createRentalSchema = z
  .object({
    item_id: z.number().int().positive(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  })
  .refine((v) => v.end_date > v.start_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  })
  .refine(
    // Compare in UTC with a 1-day grace so no timezone blocks a same-day start.
    (v) => v.start_date >= new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    { message: "Start date cannot be in the past", path: ["start_date"] }
  );

export const sendMessageSchema = z.object({
  recipient_id: z.number().int().positive(),
  content: z.string().min(1, "Message cannot be empty").max(5000),
  rental_id: z.number().int().positive().optional(),
});

// Evidence photos are private storage object paths (from the evidence
// upload endpoint), not public URLs — validate shape, not URL-ness.
const evidencePath = z.string().min(1).max(300);

export const createDisputeSchema = z.object({
  rental_id: z.number().int().positive(),
  dispute_type: z.enum(["damage", "theft", "late_return", "other"]),
  description: z.string().min(10, "Describe what happened (10+ characters)").max(5000),
  evidence_photos: z.array(evidencePath).max(5).optional(),
});

export const paymentIntentSchema = z.object({
  rental_id: z.number().int().positive(),
});

// ===== Phase 4: pickup / return / incidents =====
export const INCIDENT_TYPE_VALUES = [
  "late_return",
  "damage",
  "missing_accessory",
  "missing_item",
  "theft_suspected",
  "wrong_item_returned",
  "other",
] as const;

const accessoryChecklist = z
  .array(z.object({ name: z.string().min(1).max(120), present: z.boolean() }))
  .max(30);

export const confirmPickupSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit pickup code"),
  photos: z.array(evidencePath).max(8).optional(),
  notes: z.string().max(2000).optional(),
  accessories: accessoryChecklist.optional(),
});

export const submitReturnSchema = z.object({
  photos: z.array(evidencePath).max(8).optional(),
  notes: z.string().max(2000).optional(),
  accessories: accessoryChecklist.optional(),
});

export const reviewReturnSchema = z.object({
  action: z.enum(["accept", "report_issue"]),
  // required when action = report_issue
  incident_type: z.enum(INCIDENT_TYPE_VALUES).optional(),
  description: z.string().max(5000).optional(),
  evidence: z.array(evidencePath).max(8).optional(),
});

export const createIncidentSchema = z.object({
  rental_id: z.number().int().positive(),
  type: z.enum(INCIDENT_TYPE_VALUES),
  description: z.string().min(10, "Describe the issue (10+ characters)").max(5000),
  evidence: z.array(evidencePath).max(8).optional(),
});

export const adminIncidentActionSchema = z.object({
  action: z.enum([
    "under_review",
    "request_evidence",
    "resolve_owner",
    "resolve_renter",
    "close",
  ]),
  reason: z.string().max(2000).optional(),
});

export const rateRentalSchema = z.object({
  rating: z.number().int().min(1).max(5),
});
