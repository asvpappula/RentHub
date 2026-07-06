"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { FiPackage, FiMessageSquare } from "react-icons/fi";
import type { Item, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import RatingStars from "@/components/RatingStars";
import TrustScore from "@/components/TrustScore";
import VerificationBadges from "@/components/VerificationBadges";
import ItemCard from "@/components/ItemCard";
import EmptyState from "@/components/EmptyState";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${id}`).then((r) => r.json()),
      fetch(`/api/items?ownerId=${id}`).then((r) => r.json()),
    ])
      .then(([userData, itemData]) => {
        setProfile(userData.user ?? null);
        setItems(
          (itemData.items ?? []).filter(
            (i: Item) => i.availability_status === "available"
          )
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Profile not found</h1>
        <Link href="/browse" className="mt-6 inline-block">
          <Button>Browse items</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Avatar src={profile.avatar_url} name={profile.name} size="xl" />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Member since {formatDate(profile.created_at)} ·{" "}
              {profile.total_rentals} rental{profile.total_rentals === 1 ? "" : "s"}
            </p>
            {profile.average_rating != null && (
              <div className="mt-1.5 flex justify-center sm:justify-start">
                <RatingStars
                  rating={Number(profile.average_rating)}
                  reviewCount={profile.total_reviews}
                  size="md"
                />
              </div>
            )}
            <div className="mt-3 flex justify-center sm:justify-start">
              <VerificationBadges user={profile} />
            </div>
            {profile.bio && (
              <p className="mt-4 text-sm text-slate-500">{profile.bio}</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <TrustScore user={profile} size="lg" />
            <span className="text-xs font-medium text-slate-400">Trust score</span>
            {me && me.id !== profile.id && (
              <Link href={`/messages?user=${profile.id}`}>
                <Button variant="outline" size="sm">
                  <FiMessageSquare className="h-4 w-4" />
                  Message
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">
        Listings by {profile.name?.split(" ")[0]}
      </h2>
      <div className="mt-3">
        {items.length === 0 ? (
          <EmptyState
            icon={<FiPackage className="h-6 w-6" />}
            title="No active listings"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
