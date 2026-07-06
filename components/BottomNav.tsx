"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiHome,
  FiSearch,
  FiPlusCircle,
  FiMessageSquare,
  FiUser,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", icon: FiHome, label: "Home" },
  { href: "/browse", icon: FiSearch, label: "Browse" },
  { href: "/owner/list-item", icon: FiPlusCircle, label: "List" },
  { href: "/messages", icon: FiMessageSquare, label: "Messages" },
  { href: "/dashboard", icon: FiUser, label: "Account" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {TABS.map(({ href, icon: Icon, label }) => {
          const target =
            !user && href !== "/" && href !== "/browse" ? "/login" : href;
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={target}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary-600" : "text-slate-400"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
