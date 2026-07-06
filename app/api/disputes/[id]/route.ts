import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

const updateSchema = z.object({
  status: z.enum(["pending", "under_review", "resolved", "rejected"]),
});

async function getAuthorizedDispute(id: number, userId: number, admin: Awaited<ReturnType<typeof requireUser>>["admin"]) {
  const { data: dispute } = await admin
    .from("disputes")
    .select("*, rental:rentals(renter_id, owner_id, item:items(title))")
    .eq("id", id)
    .single();
  if (!dispute) throw new ApiError("Dispute not found", 404);
  if (
    dispute.rental?.renter_id !== userId &&
    dispute.rental?.owner_id !== userId
  )
    throw new ApiError("Forbidden", 403);
  return dispute;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    const dispute = await getAuthorizedDispute(Number(id), user.id, admin);
    return NextResponse.json({ dispute });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    await getAuthorizedDispute(Number(id), user.id, admin);

    const { status } = await parseBody(request, updateSchema);
    const { data, error } = await admin
      .from("disputes")
      .update({ status })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ dispute: data });
  } catch (err) {
    return handleApiError(err);
  }
}
