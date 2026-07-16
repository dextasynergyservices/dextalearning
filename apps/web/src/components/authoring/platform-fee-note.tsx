import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getPlatformFeePct } from "@/lib/payments-api";

/**
 * Transparency note on the pricing panel (§2): tells the creator the
 * non-refundable platform fee taken off every sale, so they understand their
 * net. Renders nothing until the fee is loaded (or if it's 0).
 */
export function PlatformFeeNote() {
	const { t } = useTranslation("authoring");
	const { data } = useQuery({
		queryKey: ["platform-fee"],
		queryFn: getPlatformFeePct,
		staleTime: 5 * 60_000,
	});
	if (!data || data.pct <= 0) return null;

	return (
		<div className="mt-2 flex items-start gap-2 rounded-card border border-border bg-muted/40 px-3 py-2.5 text-muted-foreground text-xs">
			<Info className="mt-0.5 size-3.5 shrink-0 text-brand-primary" />
			<p>
				{t("settings.platform_fee_note", {
					defaultValue:
						"A {{pct}}% platform fee applies to every paid sale (non-refundable). The 90/10 revenue split is on the remaining {{rest}}%.",
					pct: data.pct,
					rest: 100 - data.pct,
				})}
			</p>
		</div>
	);
}
