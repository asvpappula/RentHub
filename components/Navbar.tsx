"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  FiSearch,
  FiBell,
  FiMessageSquare,
  FiPlusCircle,
  FiLogOut,
  FiSettings,
  FiGrid,
  FiUser,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/browse${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 font-bold text-white">
            R
          </span>
          <span className="hidden text-lg font-bold text-slate-900 sm:block">
            RentHub
          </span>
        </Link>

        <form onSubmit={submitSearch} className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drills, cameras, tents…"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-1.5">
          <Link
            href="/browse"
            className={cn(
              "hidden md:block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50",
              pathname === "/browse" ? "text-primary-600" : "text-slate-600"
            )}
          >
            Browse
          </Link>

          {loading ? null : user ? (
            <>
              <Link
                href="/owner/list-item"
                className="hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <FiPlusCircle className="h-4 w-4" />
                List an item
              </Link>
              <Link
                href="/messages"
                className="relative rounded-lg p-2.5 text-slate-500 hover:bg-slate-50"
                aria-label="Messages"
              >
                <FiMessageSquare className="h-5 w-5" />
              </Link>
              <Link
                href="/dashboard"
                className="relative rounded-lg p-2.5 text-slate-500 hover:bg-slate-50"
                aria-label="Notifications"
              >
                <FiBell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="ml-1 rounded-full ring-2 ring-transparent transition hover:ring-primary-200"
                  aria-label="Account menu"
                >
                  <Avatar src={user.avatar_url} name={user.name} size="sm" />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-56 animate-fade-in-up rounded-xl border border-slate-100 bg-white py-2 shadow-lg">
                      <div className="border-b border-slate-50 px-4 py-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                      {[
                        { href: "/dashboard", icon: FiUser, label: "Renter dashboard" },
                        { href: "/owner/dashboard", icon: FiGrid, label: "Owner dashboard" },
                        { href: "/settings", icon: FiSettings, label: "Settings" },
                      ].map(({ href, icon: Icon, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Link>
                      ))}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <FiLogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Log in
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
