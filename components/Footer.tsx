import Link from "next/link";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { label: "Browse items", href: "/browse" },
      { label: "List an item", href: "/owner/list-item" },
      { label: "How it works", href: "/#how-it-works" },
    ],
  },
  {
    title: "Trust & Safety",
    links: [
      { label: "Verification", href: "/#trust" },
      { label: "Insurance", href: "/#trust" },
      { label: "Deposit protection", href: "/#trust" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Messages", href: "/messages" },
      { label: "Settings", href: "/settings" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 font-bold text-white">
                R
              </span>
              <span className="text-lg font-bold text-slate-900">RentHub</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Rent anything from people nearby. Insured, verified, and
              deposit-protected.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-slate-900">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-primary-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} RentHub. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
