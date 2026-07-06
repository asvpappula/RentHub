import Link from "next/link";
import {
  FiSearch,
  FiCalendar,
  FiRefreshCw,
  FiShield,
  FiCheckCircle,
  FiLock,
  FiMapPin,
  FiStar,
  FiArrowRight,
} from "react-icons/fi";
import Button from "@/components/ui/Button";
import Footer from "@/components/Footer";
import { CATEGORIES } from "@/types";

const STEPS = [
  {
    icon: FiSearch,
    title: "Find what you need",
    text: "Search thousands of items listed by verified neighbors — tools, cameras, camping gear, party equipment and more.",
  },
  {
    icon: FiCalendar,
    title: "Book & pay securely",
    text: "Pick your dates, see the full price upfront, and pay through Stripe. Your deposit is held in escrow, never handed over in cash.",
  },
  {
    icon: FiRefreshCw,
    title: "Use it, return it",
    text: "Pick up or get it delivered. Return it when you're done and your deposit is released automatically.",
  },
];

const TRUST = [
  {
    icon: FiCheckCircle,
    title: "Verified members",
    text: "ID and phone verification plus community ratings on every profile.",
  },
  {
    icon: FiShield,
    title: "Damage insurance",
    text: "Every rental includes insurance coverage — owners are protected against accidents.",
  },
  {
    icon: FiLock,
    title: "Deposit escrow",
    text: "Deposits are authorized on the renter's card and only captured if something goes wrong.",
  },
  {
    icon: FiMapPin,
    title: "GPS tracking",
    text: "High-value items can require GPS tracking for extra peace of mind.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I rented a $2,000 camera for a weekend shoot for $45. The deposit hold made the owner comfortable and I saved a fortune.",
    name: "Maya R.",
    role: "Renter · Photographer",
  },
  {
    quote:
      "My pressure washer used to sit in the garage 360 days a year. Now it earns me around $200 a month on RentHub.",
    name: "Dan K.",
    role: "Owner · Homeowner",
  },
  {
    quote:
      "The insurance claim process actually works. A renter dented my trailer, and the deposit covered the repair in two days.",
    name: "Priya S.",
    role: "Owner · Landscaper",
  },
];

const PRICING = [
  {
    name: "Renters",
    price: "Free",
    detail: "Pay only for what you rent",
    features: [
      "No membership fees",
      "5% insurance fee per rental",
      "Deposit fully refundable",
      "24/7 dispute support",
    ],
    highlight: false,
  },
  {
    name: "Owners",
    price: "15%",
    detail: "commission per completed rental",
    features: [
      "Free unlimited listings",
      "Insurance included",
      "Deposit protection",
      "Weekly payouts",
    ],
    highlight: true,
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
            <FiShield className="h-3.5 w-3.5" />
            Insured · Verified · Deposit-protected
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Why buy it when you can{" "}
            <span className="text-primary-600">rent it</span> from a neighbor?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            The average power drill is used for 13 minutes in its lifetime.
            RentHub connects you with people nearby who already own what you
            need — for a fraction of the price.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/browse">
              <Button size="lg">
                Browse items
                <FiArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/owner/list-item">
              <Button size="lg" variant="outline">
                Earn from your stuff
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.slice(0, 6).map((c) => (
              <Link
                key={c}
                href={`/browse?category=${encodeURIComponent(c)}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 transition hover:border-primary-300 hover:text-primary-700"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          How it works
        </h2>
        <p className="mt-2 text-center text-slate-500">
          Three steps between you and the thing you need.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-slate-100 bg-white p-8 shadow-sm"
            >
              <span className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white">
                {i + 1}
              </span>
              <step.icon className="h-8 w-8 text-primary-600" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            Built on trust
          </h2>
          <p className="mt-2 text-center text-slate-500">
            Lending your stuff to strangers sounds scary. We fixed that.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.title} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-50">
                  <t.icon className="h-5 w-5 text-secondary-600" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{t.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Loved by renters and owners
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <FiStar key={i} className="h-4 w-4 fill-amber-400" />
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-slate-600">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4">
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            Simple, honest pricing
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 ${
                  tier.highlight
                    ? "bg-primary-600 text-white shadow-lg"
                    : "bg-white shadow-sm border border-slate-100"
                }`}
              >
                <h3
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    tier.highlight ? "text-primary-100" : "text-slate-400"
                  }`}
                >
                  {tier.name}
                </h3>
                <p className="mt-3 text-4xl font-extrabold">
                  {tier.price}
                  <span
                    className={`ml-2 text-sm font-normal ${
                      tier.highlight ? "text-primary-100" : "text-slate-400"
                    }`}
                  >
                    {tier.detail}
                  </span>
                </p>
                <ul className="mt-6 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <FiCheckCircle
                        className={`h-4 w-4 shrink-0 ${
                          tier.highlight ? "text-primary-200" : "text-primary-500"
                        }`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">
          Ready to stop buying things you use once?
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup">
            <Button size="lg">Create a free account</Button>
          </Link>
          <Link href="/browse">
            <Button size="lg" variant="ghost">
              Just browsing <FiArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
