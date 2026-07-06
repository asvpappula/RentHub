import Link from "next/link";
import { FiImage } from "react-icons/fi";
import type { Item } from "@/types";
import { formatMoney } from "@/lib/utils";
import RatingStars from "@/components/RatingStars";
import TrustBadge from "@/components/TrustBadge";
import Avatar from "@/components/ui/Avatar";

export default function ItemCard({ item }: { item: Item }) {
  const photo = item.photos?.find((p) => p.photo_type === "main") ?? item.photos?.[0];

  return (
    <Link
      href={`/item/${item.id}`}
      className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-primary-200"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.photo_url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <FiImage className="h-10 w-10" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur">
          {item.category}
        </span>
      </div>

      <div className="mt-3 space-y-2 px-1 pb-1">
        <h3 className="line-clamp-1 font-semibold text-slate-900 group-hover:text-primary-700">
          {item.title}
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-slate-900">
            <span className="text-lg font-bold">{formatMoney(item.daily_rate)}</span>
            <span className="text-sm text-slate-500">/day</span>
          </p>
          {item.average_rating != null && (
            <RatingStars rating={Number(item.average_rating)} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <TrustBadge kind="insurance" />
          {item.gps_tracking_required && <TrustBadge kind="gps" />}
        </div>

        {item.owner && (
          <div className="flex items-center gap-2 border-t border-slate-50 pt-2">
            <Avatar src={item.owner.avatar_url} name={item.owner.name} size="sm" />
            <span className="text-xs text-slate-500 line-clamp-1">
              {item.owner.name}
            </span>
            {item.owner.id_verified && (
              <span className="ml-auto">
                <TrustBadge kind="id_verified" label="Verified" />
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
