import type { User } from "@/types";
import { trustLevel, trustScore, TRUST_COLORS, TRUST_STROKE } from "@/lib/trust";
import { cn } from "@/lib/utils";

type TrustUser = Partial<
  Pick<
    User,
    | "phone_verified"
    | "id_verified"
    | "average_rating"
    | "total_reviews"
    | "total_rentals"
    | "created_at"
  >
>;

/** Circular trust-score indicator (0–100). */
export default function TrustScore({
  user,
  size = "md",
  cleanClaimsRecord,
}: {
  user: TrustUser;
  size?: "sm" | "md" | "lg";
  cleanClaimsRecord?: boolean;
}) {
  const score = trustScore(user, { cleanClaimsRecord });
  const level = trustLevel(score);

  const px = size === "lg" ? 96 : size === "md" ? 64 : 40;
  const stroke = size === "lg" ? 8 : size === "md" ? 6 : 4;
  const r = (px - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      title={`Trust score ${score}/100 — see How Trust Works for the breakdown`}
      style={{ width: px, height: px }}
    >
      <svg width={px} height={px} className="-rotate-90">
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-100"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={TRUST_STROKE[level]}
        />
      </svg>
      <span
        className={cn(
          "absolute font-bold",
          TRUST_COLORS[level],
          size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-[10px]"
        )}
      >
        {score}
      </span>
    </div>
  );
}
