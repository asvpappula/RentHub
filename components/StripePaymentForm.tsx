"use client";

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface StripePaymentFormProps {
  clientSecret: string;
  label: string;
  onSuccess: (paymentIntentId: string) => void;
}

function InnerForm({ label, onSuccess }: Omit<StripePaymentFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      const message = error.message ?? "Payment failed. Please try again.";
      setErrorMessage(message);
      toast("error", message);
      setSubmitting(false);
      return;
    }

    if (
      paymentIntent &&
      (paymentIntent.status === "succeeded" ||
        paymentIntent.status === "requires_capture")
    ) {
      onSuccess(paymentIntent.id);
    } else {
      const message = `Payment not completed (status: ${paymentIntent?.status ?? "unknown"}). Please try again.`;
      setErrorMessage(message);
      toast("warning", message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}
      <Button type="submit" loading={submitting} disabled={!stripe} className="w-full">
        {submitting ? "Processing payment…" : label}
      </Button>
    </form>
  );
}

export default function StripePaymentForm({
  clientSecret,
  label,
  onSuccess,
}: StripePaymentFormProps) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#10b981",
            borderRadius: "12px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      }}
    >
      <InnerForm label={label} onSuccess={onSuccess} />
    </Elements>
  );
}
