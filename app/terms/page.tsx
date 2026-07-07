import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
};

// NOTE: This is a solid starting template, but have a licensed attorney
// review it before public launch — marketplace liability varies by state.

const EFFECTIVE_DATE = "July 6, 2026";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">
        {number}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-400">
          Effective {EFFECTIVE_DATE} · By creating an account or using RentHub,
          you agree to these Terms.
        </p>

        <Section number={1} title="What RentHub is">
          <p>
            RentHub is a peer-to-peer marketplace that connects people who own
            items (&ldquo;Owners&rdquo;) with people who want to rent them
            (&ldquo;Renters&rdquo;). RentHub provides the platform — listings,
            booking, payments, messaging, deposits, and dispute tools — but is
            not a party to the rental transaction itself. Each rental is a
            direct agreement between the Owner and the Renter.
          </p>
        </Section>

        <Section number={2} title="Accounts and verification">
          <p>
            You must be 18 or older and provide accurate information. One
            account per person; fake, duplicate, or impersonation accounts are
            prohibited. Email verification is required, and phone or government
            ID verification may be required before certain rentals. We may
            decline, limit, or revoke verification at our discretion.
          </p>
        </Section>

        <Section number={3} title="The rental process">
          <p>
            A rental request becomes binding when the Owner approves it and the
            Renter completes payment. The total price includes the rental rate,
            an insurance fee, and a refundable security deposit. The deposit is
            authorized (held) on the Renter&apos;s payment card in escrow — it
            is only charged if a damage or theft claim is approved through the
            dispute process. Each rental is also governed by a Rental
            Agreement accepted at checkout.
          </p>
        </Section>

        <Section number={4} title="Renter responsibilities">
          <p>
            Renters must use items with reasonable care and only for their
            intended purpose, return them on time and in the condition
            received, and promptly report any damage, malfunction, loss, or
            theft. Late returns may incur additional daily charges. Failure to
            return an item may be treated as theft and referred to law
            enforcement.
          </p>
        </Section>

        <Section number={5} title="Owner responsibilities">
          <p>
            Owners must accurately describe their items, ensure items are safe
            and in working order, honor confirmed bookings, and release
            deposits promptly after damage-free returns. Owners are responsible
            for complying with any laws applicable to renting out their items.
          </p>
        </Section>

        <Section number={6} title="Prohibited activities">
          <p>
            The following result in immediate account termination and possible
            legal action: theft or intentional non-return of items; fraud,
            including payment fraud and false damage or insurance claims;
            listing stolen, illegal, dangerous, or recalled items; harassment
            of other members; circumventing RentHub&apos;s payment system to
            avoid fees; and any use of the platform for unlawful purposes.
          </p>
        </Section>

        <Section number={7} title="Payments, fees, and deposits">
          <p>
            Payments are processed by Stripe; RentHub does not store card
            numbers. Renters pay the rental rate plus a 5% insurance fee.
            Owners receive their rental earnings minus a 15% platform
            commission. Deposits are held in escrow as described in Section 3.
            Fees are non-refundable once a rental is confirmed except where
            required by law.
          </p>
        </Section>

        <Section number={8} title="Insurance and claims">
          <p>
            Every confirmed rental includes damage protection covering
            accidental damage, theft, and loss up to $500 per rental (or the
            item&apos;s listed value, whichever is lower). Claims must be filed
            within 72 hours of the rental&apos;s scheduled end, with supporting
            evidence. Intentional damage, normal wear and tear, consequential
            losses, and items misrepresented at listing are not covered.
            RentHub&apos;s decision on claims is final, subject to one appeal.
          </p>
        </Section>

        <Section number={9} title="Disputes">
          <p>
            Damage and theft reports are handled through RentHub&apos;s dispute
            process: either party may file with evidence, the other party may
            respond, and the outcome determines whether the deposit is released
            or claimed. Disputes with RentHub itself shall first be attempted
            to be resolved informally by contacting support; unresolved
            disputes are subject to binding arbitration where permitted by
            law, and you waive participation in class actions to the extent
            permissible.
          </p>
        </Section>

        <Section number={10} title="Limitation of liability">
          <p>
            RentHub provides the platform &ldquo;as is&rdquo; and does not
            guarantee the condition, safety, legality, or fitness of any listed
            item, nor the conduct of any member. To the maximum extent
            permitted by law, RentHub&apos;s total liability for any claim
            arising from the platform is limited to the fees RentHub earned
            from the transaction giving rise to the claim. RentHub is not
            liable for indirect, incidental, or consequential damages, or for
            personal injury or property damage arising from the use of rented
            items.
          </p>
        </Section>

        <Section number={11} title="Termination">
          <p>
            You may close your account at any time once you have no active
            rentals or unresolved disputes. RentHub may suspend or terminate
            accounts that violate these Terms, present fraud risk, or harm
            other members, with or without notice. Sections 8–12 survive
            termination.
          </p>
        </Section>

        <Section number={12} title="General">
          <p>
            These Terms are governed by the laws of the State of California,
            without regard to conflict-of-law rules. We may update these Terms;
            material changes will be announced in-app and continued use
            constitutes acceptance. If any provision is unenforceable, the
            remainder stays in effect. Questions:{" "}
            <a
              href="mailto:support@renthub.app"
              className="font-semibold text-primary-600 hover:underline"
            >
              support@renthub.app
            </a>
            .
          </p>
        </Section>

        <p className="mt-10 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          By creating a RentHub account, checking the acceptance box at signup,
          or continuing to use RentHub, you acknowledge that you have read,
          understood, and agree to be bound by these Terms of Service.{" "}
          <Link href="/signup" className="font-semibold text-primary-600 hover:underline">
            Create an account →
          </Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}
