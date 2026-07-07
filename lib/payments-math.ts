/**
 * Server-authoritative marketplace money math. The frontend NEVER decides any
 * of these amounts — every value here is derived from immutable rental fields.
 *
 * Economics (all integer cents):
 *   subtotal        = daily_rate * number_of_days           (rental rate)
 *   insurance       = insurance_fee                          (5% of subtotal, stored on the rental)
 *   renter charge   = subtotal + insurance                  (what the renter pays for the rental)
 *   platform commission = 15% of subtotal
 *   owner payout    = subtotal - commission                 (= 85% of subtotal)
 *   platform fee    = commission + insurance                (platform's total take = 20% of subtotal)
 *   deposit         = deposit_amount                        (held separately, never transferred)
 */

export const PLATFORM_COMMISSION_RATE = 0.15;

export interface RentalAmounts {
  subtotalCents: number;
  insuranceCents: number;
  rentalChargeCents: number;
  platformCommissionCents: number;
  platformFeeCents: number;
  ownerPayoutCents: number;
  depositCents: number;
}

interface RentalLike {
  daily_rate: number;
  number_of_days: number;
  insurance_fee: number;
  deposit_amount: number;
}

export function computeRentalAmounts(rental: RentalLike): RentalAmounts {
  const subtotalCents = Math.round(rental.daily_rate * rental.number_of_days * 100);
  const insuranceCents = Math.round(rental.insurance_fee * 100);
  const rentalChargeCents = subtotalCents + insuranceCents;
  const platformCommissionCents = Math.round(subtotalCents * PLATFORM_COMMISSION_RATE);
  const ownerPayoutCents = subtotalCents - platformCommissionCents;
  const platformFeeCents = platformCommissionCents + insuranceCents;
  const depositCents = Math.round(rental.deposit_amount * 100);

  return {
    subtotalCents,
    insuranceCents,
    rentalChargeCents,
    platformCommissionCents,
    platformFeeCents,
    ownerPayoutCents,
    depositCents,
  };
}

/** Whether owner payouts are actually wired up (Connect enabled by ops). */
export function connectEnabled(): boolean {
  return process.env.STRIPE_CONNECT_ENABLED === "true";
}
