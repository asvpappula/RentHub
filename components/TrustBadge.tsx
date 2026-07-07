import {
  FiCheckCircle,
  FiShield,
  FiLock,
  FiMapPin,
  FiPhone,
} from "react-icons/fi";
import Badge from "@/components/ui/Badge";

type TrustKind =
  | "id_verified"
  | "phone_verified"
  | "insurance"
  | "deposit"
  | "gps";

const CONFIG: Record<
  TrustKind,
  { icon: React.ReactNode; label: string; className: string; explainer: string }
> = {
  id_verified: {
    icon: <FiCheckCircle className="h-3 w-3" />,
    label: "ID verified",
    className: "bg-primary-50 text-primary-700 ring-primary-200",
    explainer: "This member confirmed their identity with a government ID.",
  },
  phone_verified: {
    icon: <FiPhone className="h-3 w-3" />,
    label: "Phone verified",
    className: "bg-secondary-50 text-secondary-700 ring-secondary-200",
    explainer: "This member confirmed their phone number via SMS.",
  },
  insurance: {
    icon: <FiShield className="h-3 w-3" />,
    label: "Protected",
    className: "bg-secondary-50 text-secondary-700 ring-secondary-200",
    explainer:
      "Accidental damage during the rental is covered by RentHub damage protection, subject to review (5% fee at checkout).",
  },
  deposit: {
    icon: <FiLock className="h-3 w-3" />,
    label: "Deposit protected",
    className: "bg-secondary-50 text-secondary-700 ring-secondary-200",
    explainer:
      "The deposit is held in escrow on the renter's card and only charged if a damage claim is approved.",
  },
  gps: {
    icon: <FiMapPin className="h-3 w-3" />,
    label: "GPS tracked",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    explainer:
      "The owner requires a GPS tracker on this item during the rental for theft protection.",
  },
};

export default function TrustBadge({
  kind,
  label,
}: {
  kind: TrustKind;
  label?: string;
}) {
  const config = CONFIG[kind];
  return (
    <Badge className={config.className} title={config.explainer}>
      {config.icon}
      {label ?? config.label}
    </Badge>
  );
}
