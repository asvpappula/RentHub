"use client";

import { use } from "react";
import Link from "next/link";
import { FiFileText, FiCheckCircle } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useRentalUpdates } from "@/hooks/useRentalUpdates";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import PriceBreakdown from "@/components/PriceBreakdown";

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-1 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function RentalAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { rental, loading } = useRentalUpdates(Number(id));

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!rental || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Agreement not found</h1>
        <Link href="/dashboard" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const quote = {
    dailyRate: rental.daily_rate,
    numberOfDays: rental.number_of_days,
    subtotal: rental.daily_rate * rental.number_of_days,
    insuranceFee: rental.insurance_fee,
    depositAmount: rental.deposit_amount,
    total: rental.total_cost,
  };
  const coverage = Math.min(500, rental.deposit_amount + 500);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <FiFileText className="h-7 w-7 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rental Agreement</h1>
            <p className="text-xs text-slate-400">
              Rental #{rental.id} · governed by the{" "}
              <Link href="/terms" className="font-semibold text-primary-600 hover:underline">
                RentHub Terms of Service
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
          <p>
            <span className="font-semibold text-slate-900">Owner:</span>{" "}
            {rental.owner?.name}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Renter:</span>{" "}
            {rental.renter?.name}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Item:</span>{" "}
            <Link
              href={`/item/${rental.item_id}`}
              className="font-semibold text-primary-600 hover:underline"
            >
              {rental.item?.title}
            </Link>{" "}
            (condition at listing: {rental.item?.condition})
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Period:</span>{" "}
            {formatDate(rental.start_date)} → {formatDate(rental.end_date)} (
            {rental.number_of_days} {rental.number_of_days === 1 ? "day" : "days"})
          </p>
        </div>

        <Clause title="1. Payment">
          <PriceBreakdown quote={quote} />
        </Clause>

        <Clause title="2. Security deposit">
          The {formatMoney(rental.deposit_amount)} deposit is authorized on the
          Renter&apos;s card and held in escrow — it is not charged. It is
          released automatically when the Owner confirms a damage-free return,
          and may only be captured through RentHub&apos;s dispute process.
        </Clause>

        <Clause title="3. Insurance">
          This rental includes RentHub damage protection covering accidental
          damage, theft, and loss up to {formatMoney(coverage)}. Intentional
          damage and normal wear and tear are excluded. Claims must be filed
          within 72 hours of the rental&apos;s end.
        </Clause>

        <Clause title="4. Renter's responsibilities">
          Use the item with reasonable care and only as intended; return it by{" "}
          {formatDate(rental.end_date)} in the condition received; report any
          damage, malfunction, or theft immediately through the rental page.
          Late returns accrue the daily rate; non-return may be treated as
          theft.
        </Clause>

        <Clause title="5. Owner's responsibilities">
          Provide the item as described, safe and in working order, at the
          agreed time. Release the deposit promptly after a damage-free return.
        </Clause>

        <Clause title="6. Cancellation">
          The Renter may cancel free of charge before payment. After payment,
          cancellations must be arranged with the Owner via messages; the
          insurance fee is non-refundable.
        </Clause>

        <Clause title="7. Damage, theft & disputes">
          Either party may file a report with photo evidence from the rental
          page. The other party may respond, and the outcome determines whether
          the deposit is released or claimed. This agreement is used as
          evidence in dispute resolution.
        </Clause>

        <div className="mt-8 border-t border-slate-100 pt-5">
          {rental.agreement_accepted_at ? (
            <p className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <FiCheckCircle className="h-5 w-5" />
              Digitally accepted by {rental.renter?.name} on{" "}
              {formatDateTime(rental.agreement_accepted_at)}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Not yet accepted — the Renter accepts this agreement during
              checkout, before payment.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Link href={`/rental/${rental.id}`}>
              <Button variant="outline">Back to rental</Button>
            </Link>
            {rental.renter_id === user.id &&
              rental.status === "approved" &&
              !rental.agreement_accepted_at && (
                <Link href={`/checkout/${rental.id}`}>
                  <Button>Continue to checkout</Button>
                </Link>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
