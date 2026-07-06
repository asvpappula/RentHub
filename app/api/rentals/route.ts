import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { createRentalSchema } from "@/lib/validation";
import { quotePrice } from "@/lib/utils";
import { checkFraudRisk } from "@/lib/fraud";

const RENTAL_SELECT =
  "*, item:items(*, photos:item_photos(*)), renter:users!rentals_renter_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified, background_check_status), owner:users!rentals_owner_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified, background_check_status)";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role"); // "renter" | "owner" | null (both)
    const status = searchParams.get("status");

    let query = admin.from("rentals").select(RENTAL_SELECT);
    if (role === "renter") query = query.eq("renter_id", user.id);
    else if (role === "owner") query = query.eq("owner_id", user.id);
    else query = query.or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`);
    if (status) query = query.in("status", status.split(","));

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({ rentals: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    rateLimit(`rental:${user.id}`, 20);
    const input = await parseBody(request, createRentalSchema);

    const { data: item } = await admin
      .from("items")
      .select("*")
      .eq("id", input.item_id)
      .single();
    if (!item) throw new ApiError("Item not found", 404);
    if (item.owner_id === user.id)
      throw new ApiError("You cannot rent your own item", 400);
    if (item.availability_status !== "available")
      throw new ApiError("This item is not available", 409);

    // Reject overlapping bookings.
    const { count: overlapping } = await admin
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("item_id", item.id)
      .in("status", ["approved", "confirmed", "active"])
      .lte("start_date", input.end_date)
      .gte("end_date", input.start_date);
    if ((overlapping ?? 0) > 0)
      throw new ApiError("Item is already booked for those dates", 409);

    const { riskLevel } = await checkFraudRisk(admin, user);
    if (riskLevel === "high")
      throw new ApiError(
        "Complete verification to rent — verify your phone and ID in Settings.",
        403
      );

    const quote = quotePrice(
      item.daily_rate,
      item.deposit_amount,
      Number(item.insurance_fee_percentage),
      input.start_date,
      input.end_date
    );

    const { data: rental, error } = await admin
      .from("rentals")
      .insert({
        renter_id: user.id,
        owner_id: item.owner_id,
        item_id: item.id,
        status: "pending",
        start_date: input.start_date,
        end_date: input.end_date,
        daily_rate: item.daily_rate,
        number_of_days: quote.numberOfDays,
        insurance_fee: quote.insuranceFee,
        deposit_amount: item.deposit_amount,
        total_cost: quote.total,
      })
      .select(RENTAL_SELECT)
      .single();
    if (error) throw new ApiError(error.message, 400);

    await createNotification(
      admin,
      item.owner_id,
      "rental_request",
      "New rental request",
      `${user.name ?? "Someone"} wants to rent "${item.title}"`,
      rental.id
    );

    return NextResponse.json({ rental }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
