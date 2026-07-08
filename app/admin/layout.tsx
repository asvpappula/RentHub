import { redirect } from "next/navigation";
import Link from "next/link";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/payments", label: "Chargebacks" },
  { href: "/admin/webhooks", label: "Webhooks" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/listings", label: "Listings" },
];

/**
 * Server-side admin gate. The session and the backend-controlled is_admin flag
 * are checked HERE (not on the client) — a non-admin is redirected before any
 * admin page renders. Every /api/admin/* route re-checks with requireAdmin().
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login?next=/admin");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_admin")
    .eq("auth_id", authUser.id)
    .single();
  if (!profile?.is_admin) redirect("/");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white">
          ADMIN
        </span>
        <h1 className="text-xl font-bold text-slate-900">Operations</h1>
      </div>
      <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
