import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

const schema = z.object({
  reason: z.string().min(10, "Explain why you're appealing (10+ characters)").max(2000),
});

/** Renter appeals a resolution — flagged for platform review. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    const { reason } = await parseBody(request, schema);

    const { data: dispute } = await admin
      .from("disputes")
      .select("*, rental:rentals(renter_id, owner_id, item:items(title))")
      .eq("id", Number(id))
      .single();
    if (!dispute) throw new ApiError("Dispute not found", 404);
    if (dispute.rental?.renter_id !== user.id)
      throw new ApiError("Only the renter can appeal", 403);
    if (dispute.status !== "resolved")
      throw new ApiError("Only resolved disputes can be appealed", 409);

    const { data, error } = await admin
      .from("disputes")
      .update({ status: "appealed", appeal_reason: reason })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    await createNotification(
      admin,
      dispute.rental.owner_id,
      "dispute",
      "Dispute resolution appealed",
      `${user.name ?? "The renter"} appealed the resolution on "${dispute.rental?.item?.title}". RentHub support will review it.`,
      dispute.rental_id
    );

    return NextResponse.json({ dispute: data });
  } catch (err) {
    return handleApiError(err);
  }
}
