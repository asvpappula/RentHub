export interface User {
  id: number;
  auth_id?: string | null;
  email: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  id_verified: boolean;
  id_verified_at?: string | null;
  stripe_verification_session_id?: string | null;
  terms_accepted_at?: string | null;
  is_admin?: boolean;
  suspended?: boolean;
  suspended_reason?: string | null;
  email_notifications?: boolean;
  average_rating: number | null;
  total_reviews: number;
  total_rentals: number;
  created_at: string;
  updated_at: string;
}

export type ItemCondition = "new" | "like_new" | "good" | "fair" | "worn";

export type AvailabilityStatus = "available" | "rented" | "unavailable";

export interface Item {
  id: number;
  owner_id: number;
  category: string;
  title: string;
  description: string | null;
  condition: ItemCondition;
  daily_rate: number;
  deposit_amount: number;
  insurance_fee_percentage: number;
  availability_status: AvailabilityStatus;
  hidden?: boolean;
  gps_tracking_required: boolean;
  delivery_options: string | null;
  view_count: number;
  rental_count: number;
  average_rating: number | null;
  /** PRIVATE — only surfaced to owner/admin/participant, never in public DTOs */
  serial_number?: string | null;
  accessories?: string[];
  created_at: string;
  updated_at: string;
  owner?: User;
  photos?: ItemPhoto[];
}

export interface ItemPhoto {
  id: number;
  item_id: number;
  photo_url: string;
  photo_type: "main" | "gallery" | "condition";
  uploaded_at: string;
}

export type RentalStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "active"
  | "completed"
  | "rejected"
  | "cancelled"
  | "disputed";

export type DepositStatus =
  | "pending"
  | "held"
  | "refunding"
  | "claiming"
  | "refunded"
  | "claimed";

export interface Rental {
  id: number;
  renter_id: number;
  owner_id: number;
  item_id: number;
  status: RentalStatus;
  start_date: string;
  end_date: string;
  daily_rate: number;
  number_of_days: number;
  insurance_fee: number;
  deposit_amount: number;
  total_cost: number;
  payment_intent_id: string | null;
  deposit_status: DepositStatus;
  agreement_accepted_at?: string | null;
  renter_rating: number | null;
  owner_rating: number | null;
  // Phase 4 — pickup / return handoff
  pickup_code?: string | null;
  pickup_confirmed_at?: string | null;
  pickup_confirmed_by?: number | null;
  pickup_photos?: string[];
  pickup_notes?: string | null;
  pickup_accessories?: { name: string; present: boolean }[];
  return_submitted_at?: string | null;
  return_submitted_by?: number | null;
  return_photos?: string[];
  return_notes?: string | null;
  return_reviewed_at?: string | null;
  return_reviewed_by?: number | null;
  return_status?: "none" | "submitted" | "accepted" | "issue";
  created_at: string;
  updated_at: string;
  item?: Item;
  renter?: User;
  owner?: User;
  // signed evidence URLs + open incidents added by GET /api/rentals/[id]
  pickup_photo_urls?: string[];
  return_photo_urls?: string[];
  incidents?: Incident[];
  is_late?: boolean;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  rental_id: number | null;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: User;
  recipient?: User;
}

export type NotificationType =
  | "rental_request"
  | "rental_approved"
  | "rental_rejected"
  | "rental_confirmed"
  | "rental_completed"
  | "message"
  | "dispute"
  | "deposit_held"
  | "deposit_refunded"
  | "deposit_claimed"
  // Phase 4 — handoff / incidents
  | "pickup_confirmed"
  | "return_submitted"
  | "return_accepted"
  | "incident_opened"
  | "incident_updated"
  | "late_return";

export type IncidentType =
  | "late_return"
  | "damage"
  | "missing_accessory"
  | "missing_item"
  | "theft_suspected"
  | "wrong_item_returned"
  | "other";

export type IncidentStatus =
  | "open"
  | "under_review"
  | "awaiting_evidence"
  | "resolved_owner"
  | "resolved_renter"
  | "closed";

export interface Incident {
  id: number;
  rental_id: number;
  opened_by: number;
  against_user_id: number | null;
  type: IncidentType;
  status: IncidentStatus;
  description: string;
  /** private storage object paths */
  evidence: string[];
  /** signed URLs added by the API for authorized readers */
  evidence_urls?: string[];
  resolution_notes: string | null;
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  rental?: Rental;
  opener?: User;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string | null;
  related_rental_id: number | null;
  read_at: string | null;
  created_at: string;
}

export type DisputeType = "damage" | "theft" | "late_return" | "other";

export type DisputeStatus =
  | "pending"
  | "under_review"
  | "resolved"
  | "appealed";

export interface Dispute {
  id: number;
  rental_id: number;
  dispute_type: DisputeType;
  reported_by: number;
  description: string;
  status: DisputeStatus;
  evidence_photos: string[];
  response: string | null;
  resolution_notes: string | null;
  appeal_reason: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter?: User;
  rental?: Rental;
}

export type ClaimType = "damage" | "theft" | "loss";

export interface InsuranceClaim {
  id: number;
  rental_id: number;
  claimant_id: number;
  claim_type: ClaimType;
  description: string;
  photo_urls: string[];
  estimated_value: number;
  status: "pending" | "approved" | "rejected";
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  claimant?: User;
  rental?: Rental;
}

export interface Conversation {
  otherUser: User;
  lastMessage: Message;
  unreadCount: number;
}

export interface PriceQuote {
  dailyRate: number;
  numberOfDays: number;
  subtotal: number;
  insuranceFee: number;
  depositAmount: number;
  total: number;
}

export const CATEGORIES = [
  "Tools & DIY",
  "Cameras & Photography",
  "Outdoor & Camping",
  "Party & Events",
  "Sports & Fitness",
  "Electronics",
  "Music & Instruments",
  "Vehicles & Transport",
  "Home & Garden",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
