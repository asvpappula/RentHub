import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

/** Booked date ranges for an item (bookings that block new rentals). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createSupabaseAdminClient();

    const today = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from("rentals")
      .select("start_date, end_date")
      .eq("item_id", Number(id))
      .in("status", ["approved", "confirmed", "active"])
      .gte("end_date", today);

    return NextResponse.json({ booked: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}
