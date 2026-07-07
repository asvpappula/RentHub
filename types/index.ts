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
  gps_tracking_required: boolean;
  delivery_options: string | null;
  view_count: number;
  rental_count: number;
  average_rating: number | null;
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

export type DepositStatus = "pending" | "held" | "refunded" | "claimed";

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
  created_at: string;
  updated_at: string;
  item?: Item;
  renter?: User;
  owner?: User;
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
  | "deposit_claimed";

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
