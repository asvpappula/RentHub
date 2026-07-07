import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  requireUser,
} from "@/lib/api-helpers";
import { connectEnabled } from "@/lib/payments-math";
import { ownerPayoutReady } from "@/lib/connect";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.status !== "pending")
      throw new ApiError("Only pending requests can be approved", 409);

    // Owners must finish payout onboarding before accepting paid bookings
    // (only enforced once Connect is live).
    if (connectEnabled() && !(await ownerPayoutReady(admin, user.id)))
      throw new ApiError(
        "Set up payouts before approving bookings — open your owner dashboard to finish onboarding.",
        409
      );

    // Re-check availability at approval time (not just at request time): the
    // item may have been booked for overlapping dates since the request.
    const { count: overlapping } = await admin
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("item_id", rental.item_id)
      .in("status", ["approved", "confirmed", "active"])
      .lte("start_date", rental.end_date)
      .gte("end_date", rental.start_date);
    if ((overlapping ?? 0) > 0)
      throw new ApiError(
        "Those dates are no longer available — another booking overlaps.",
        409
      );

    const { data, error } = await admin
      .from("rentals")
      .update({ status: "approved" })
      .eq("id", Number(id))
      .select()
      .single();
    // 23P01 = exclusion constraint (the DB-level double-booking guard).
    if (error) {
      if (error.code === "23P01")
        throw new ApiError(
          "Those dates were just booked by someone else.",
          409
        );
      throw new ApiError(error.message, 400);
    }

    await createNotification(
      admin,
      rental.renter_id,
      "rental_approved",
      "Rental request approved",
      `Your request for "${rental.item?.title}" was approved — complete checkout to confirm.`,
      rental.id
    );

    return NextResponse.json({ rental: data });
  } catch (err) {
    return handleApiError(err);
  }
}
