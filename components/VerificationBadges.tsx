import type { User } from "@/types";
import TrustBadge from "@/components/TrustBadge";
import Badge from "@/components/ui/Badge";
import { FiMail } from "react-icons/fi";

type VerifiableUser = Pick<
  User,
  "phone_verified" | "id_verified" | "background_check_status"
>;

/** The full set of verification badges for a user (email is always verified
 *  for active accounts — Supabase blocks login until confirmed). */
export default function VerificationBadges({ user }: { user: VerifiableUser }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge
        className="bg-primary-50 text-primary-700 ring-primary-200"
        title="This member confirmed their email address."
      >
        <FiMail className="h-3 w-3" />
        Email verified
      </Badge>
      {user.phone_verified && <TrustBadge kind="phone_verified" />}
      {user.id_verified && <TrustBadge kind="id_verified" />}
      {user.background_check_status === "approved" && (
        <TrustBadge kind="background_check" />
      )}
    </div>
  );
}
