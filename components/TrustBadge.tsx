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
  { icon: React.ReactNode; label: string; className: string }
> = {
  id_verified: {
    icon: <FiCheckCircle className="h-3 w-3" />,
    label: "ID verified",
    className: "bg-primary-50 text-primary-700 ring-primary-200",
  },
  phone_verified: {
    icon: <FiPhone className="h-3 w-3" />,
    label: "Phone verified",
    className: "bg-primary-50 text-primary-700 ring-primary-200",
  },
  insurance: {
    icon: <FiShield className="h-3 w-3" />,
    label: "Insured",
    className: "bg-secondary-50 text-secondary-700 ring-secondary-200",
  },
  deposit: {
    icon: <FiLock className="h-3 w-3" />,
    label: "Deposit protected",
    className: "bg-secondary-50 text-secondary-700 ring-secondary-200",
  },
  gps: {
    icon: <FiMapPin className="h-3 w-3" />,
    label: "GPS tracked",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
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
    <Badge className={config.className}>
      {config.icon}
      {label ?? config.label}
    </Badge>
  );
}
