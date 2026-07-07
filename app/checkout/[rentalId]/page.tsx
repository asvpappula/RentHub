"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiImage, FiShield, FiCheckCircle } from "react-icons/fi";
import { useRentalUpdates } from "@/hooks/useRentalUpdates";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatMoney } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import PriceBreakdown from "@/components/PriceBreakdown";
import StripePaymentForm from "@/components/StripePaymentForm";

type Step = "review" | "payment" | "deposit" | "done";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ rentalId: string }>;
}) {
  const { rentalId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { rental, loading } = useRentalUpdates(Number(rentalId));

  const [step, setStep] = useState<Step>("review");
  const [agreed, setAgreed] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (rental?.status === "confirmed" && rental.deposit_status === "held") {
      setStep("done");
    }
  }, [rental]);

  const startPayment = async () => {
    setPreparing(true);
    setPaymentError(null);
    try {
      // Digital signature: record agreement acceptance before payment.
      const agreeRes = await fetch(`/api/rentals/${rentalId}/accept-agreement`, {
        method: "POST",
      });
      if (!agreeRes.ok) {
        const agreeData = await agreeRes.json().catch(() => ({}));
        throw new Error(agreeData.error ?? "Could not record agreement acceptance");
      }

      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rental_id: Number(rentalId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start payment");
      setClientSecret(data.clientSecret);
      setStep("payment");
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Network error — check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Payment setup failed";
      setPaymentError(message);
      toast("error", message);
    } finally {
      setPreparing(false);
    }
  };

  // After the rental payment, the SERVER verifies it, places the deposit
  // hold, and confirms — all in one call. We only show a second form if the
  // bank requires authentication for the deposit (rare with saved cards).
  const onRentalPaid = async (paymentIntentId: string) => {
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirmation failed");

      if (data.needsDepositAuth && data.clientSecret) {
        toast("info", "One more step — authorize your deposit hold.");
        setClientSecret(data.clientSecret);
        setStep("deposit");
      } else {
        toast("success", "Booking confirmed — you're all set!");
        setStep("done");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const onDepositAuthorized = async (paymentIntentId: string) => {
    await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
    });
    toast("success", "Deposit hold placed — you're all set!");
    setStep("done");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Rental not found</h1>
        <Link href="/dashboard" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  if (rental.status !== "approved" && step !== "done" && step !== "deposit") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {rental.status === "pending"
            ? "Waiting for owner approval"
            : `This rental is ${rental.status}`}
        </h1>
        <p className="mt-2 text-slate-500">
          {rental.status === "pending"
            ? "You'll be able to pay as soon as the owner approves your request."
            : "Checkout is only available for approved requests."}
        </p>
        <Link href={`/rental/${rental.id}`} className="mt-6 inline-block">
          <Button>View rental</Button>
        </Link>
      </div>
    );
  }

  const photo = rental.item?.photos?.[0];
  const quote = {
    dailyRate: rental.daily_rate,
    numberOfDays: rental.number_of_days,
    subtotal: rental.daily_rate * rental.number_of_days,
    insuranceFee: rental.insurance_fee,
    depositAmount: rental.deposit_amount,
    total: rental.total_cost,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

      {/* Item summary */}
      <div className="mt-6 flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.photo_url}
              alt={rental.item?.title ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <FiImage className="h-6 w-6" />
            </div>
          )}
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">{rental.item?.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatDate(rental.start_date)} → {formatDate(rental.end_date)} (
            {rental.number_of_days} {rental.number_of_days === 1 ? "day" : "days"})
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            From {rental.owner?.name}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <PriceBreakdown quote={quote} />
      </div>

      {/* Insurance summary */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary-50 p-4 text-sm text-secondary-800">
        <FiShield className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <span className="font-semibold">Covered by RentHub insurance.</span>{" "}
          Accidental damage during the rental period is covered. The{" "}
          {formatMoney(rental.deposit_amount)} deposit is a hold on your card —
          it is only charged if a damage claim is approved.
        </p>
      </div>

      {step === "review" && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-500"
            />
            <span>
              I agree to the{" "}
              <Link
                href={`/rental/${rentalId}/agreement`}
                target="_blank"
                className="font-semibold text-primary-600 hover:underline"
              >
                Rental Agreement
              </Link>{" "}
              (deposit, insurance, and return terms) and the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-primary-600 hover:underline"
              >
                Terms of Service
              </Link>
              . This acts as my digital signature.
            </span>
          </label>
          {paymentError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {paymentError}
            </div>
          )}
          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={!agreed}
            loading={preparing}
            onClick={startPayment}
          >
            {paymentError ? "Try again" : "Continue to payment"}
          </Button>
        </div>
      )}

      {(step === "payment" || step === "deposit") && clientSecret && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">
            {step === "payment"
              ? `Pay ${formatMoney(quote.subtotal + quote.insuranceFee)} (rental + insurance)`
              : `Authorize ${formatMoney(rental.deposit_amount)} deposit hold`}
          </h2>
          <StripePaymentForm
            key={clientSecret}
            clientSecret={clientSecret}
            label={step === "payment" ? "Pay now" : "Place deposit hold"}
            onSuccess={step === "payment" ? onRentalPaid : onDepositAuthorized}
          />
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 rounded-2xl border border-primary-200 bg-primary-50/50 p-8 text-center">
          <FiCheckCircle className="mx-auto h-12 w-12 text-primary-600" />
          <h2 className="mt-3 text-xl font-bold text-slate-900">
            Booking confirmed!
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            The owner has been notified. Coordinate pickup in messages.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => router.push(`/rental/${rental.id}`)}>
              View rental
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/messages?user=${rental.owner_id}`)}
            >
              Message owner
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
