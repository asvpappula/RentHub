"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Rental } from "@/types";

/** Fetches a rental and keeps it fresh via a realtime subscription. */
export function useRentalUpdates(rentalId: number | null) {
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = () => {
    if (!rentalId) return;
    fetch(`/api/rentals/${rentalId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRental(data.rental);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!rentalId) return;
    refetch();

    const channel = supabase
      .channel(`rental:${rentalId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rentals",
          filter: `id=eq.${rentalId}`,
        },
        (payload) => {
          setRental((prev) =>
            prev ? { ...prev, ...(payload.new as Partial<Rental>) } : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalId]);

  return { rental, loading, error, refetch };
}
