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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      toast("error", error.message ?? "Payment failed. Please try again.");
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
      toast("warning", `Payment status: ${paymentIntent?.status ?? "unknown"}`);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" loading={submitting} disabled={!stripe} className="w-full">
        {label}
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
