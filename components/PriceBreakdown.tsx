import { formatMoney } from "@/lib/utils";
import type { PriceQuote } from "@/types";
import { FiInfo } from "react-icons/fi";

export default function PriceBreakdown({ quote }: { quote: PriceQuote }) {
  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between text-slate-600">
        <span>
          {formatMoney(quote.dailyRate)} × {quote.numberOfDays}{" "}
          {quote.numberOfDays === 1 ? "day" : "days"}
        </span>
        <span className="font-medium text-slate-900">
          {formatMoney(quote.subtotal)}
        </span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span className="inline-flex items-center gap-1">
          Insurance fee
          <FiInfo className="h-3.5 w-3.5 text-slate-400" />
        </span>
        <span className="font-medium text-slate-900">
          {formatMoney(quote.insuranceFee)}
        </span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Deposit (refundable, held in escrow)</span>
        <span className="font-medium text-slate-900">
          {formatMoney(quote.depositAmount)}
        </span>
      </div>
      <div className="border-t border-slate-200 pt-2.5 flex justify-between font-semibold text-slate-900">
        <span>Total due today</span>
        <span>{formatMoney(quote.total)}</span>
      </div>
      <p className="text-xs text-slate-400">
        The deposit is released back to you after the item is returned undamaged.
      </p>
    </div>
  );
}
