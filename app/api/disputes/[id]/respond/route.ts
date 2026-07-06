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
  response: z.string().min(10, "Response must be at least 10 characters").max(5000),
});

/** The party who didn't file the dispute adds their side of the story. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    const { response } = await parseBody(request, schema);

    const { data: dispute } = await admin
      .from("disputes")
      .select("*, rental:rentals(renter_id, owner_id, item:items(title))")
      .eq("id", Number(id))
      .single();
    if (!dispute) throw new ApiError("Dispute not found", 404);

    const isParty =
      dispute.rental?.renter_id === user.id || dispute.rental?.owner_id === user.id;
    if (!isParty) throw new ApiError("Forbidden", 403);
    if (dispute.reported_by === user.id)
      throw new ApiError("You filed this dispute — the other party responds", 400);
    if (!["pending", "under_review"].includes(dispute.status))
      throw new ApiError("This dispute is already resolved", 409);

    const { data, error } = await admin
      .from("disputes")
      .update({ response, status: "under_review" })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    await createNotification(
      admin,
      dispute.reported_by,
      "dispute",
      "Response added to your dispute",
      `${user.name ?? "The other party"} responded on the "${dispute.rental?.item?.title}" dispute.`,
      dispute.rental_id
    );

    return NextResponse.json({ dispute: data });
  } catch (err) {
    return handleApiError(err);
  }
}
