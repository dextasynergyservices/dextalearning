import { BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	disablePush,
	enablePush,
	isPushEnabled,
	isPushSupported,
	pushPermission,
} from "@/lib/push";
import { cn } from "@/lib/utils";

/**
 * Push-notification opt-in toggle (§8.6, Phase 5). Requests permission and
 * subscribes this browser via the service worker on enable; unsubscribes on
 * disable. Hidden on unsupported browsers; shows a hint when the user has
 * blocked notifications at the browser level (which the app can't override).
 */
export function PushOptIn() {
	const { t } = useTranslation("common");
	const supported = isPushSupported();
	const [enabled, setEnabled] = useState(false);
	const [permission, setPermission] = useState(pushPermission());
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let active = true;
		isPushEnabled().then((value) => {
			if (active) setEnabled(value);
		});
		return () => {
			active = false;
		};
	}, []);

	if (!supported) {
		return (
			<p className="text-muted-foreground text-xs">
				{t("push.unsupported", {
					defaultValue: "Push isn't supported on this browser.",
				})}
			</p>
		);
	}

	const denied = permission === "denied";

	const toggle = async () => {
		if (busy || denied) return;
		setBusy(true);
		try {
			if (enabled) {
				await disablePush();
				setEnabled(false);
			} else {
				const ok = await enablePush();
				setPermission(pushPermission());
				setEnabled(ok);
				if (ok) {
					toast.success(
						t("push.enabled_toast", {
							defaultValue: "Push notifications enabled.",
						}),
					);
				}
			}
		} catch {
			toast.error(
				t("push.error", {
					defaultValue: "Couldn't enable push notifications.",
				}),
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between gap-3">
				<span className="flex items-start gap-2.5">
					<BellRing className="mt-0.5 size-4 shrink-0 text-brand-primary" />
					<span>
						<span className="block font-medium text-foreground text-sm">
							{t("push.title", { defaultValue: "Push notifications" })}
						</span>
						<span className="text-muted-foreground text-xs">
							{t("push.hint", {
								defaultValue:
									"Get reminders on this device, even when the app is closed.",
							})}
						</span>
					</span>
				</span>
				<button
					type="button"
					role="switch"
					aria-checked={enabled}
					aria-label={t("push.title", { defaultValue: "Push notifications" })}
					disabled={busy || denied}
					onClick={toggle}
					className={cn(
						"relative h-6 w-11 shrink-0 rounded-full transition-colors",
						enabled ? "bg-brand-primary" : "bg-slate-300 dark:bg-slate-600",
						(busy || denied) && "cursor-not-allowed opacity-50",
					)}
				>
					<span
						className={cn(
							"absolute top-0.5 flex size-5 items-center justify-center rounded-full bg-card shadow-sm transition-all",
							enabled ? "left-[1.375rem]" : "left-0.5",
						)}
					>
						{busy ? (
							<Loader2 className="size-3 animate-spin text-brand-primary" />
						) : null}
					</span>
				</button>
			</div>
			{denied ? (
				<p className="mt-1.5 text-warning text-xs">
					{t("push.denied", {
						defaultValue:
							"Notifications are blocked. Enable them in your browser settings to turn this on.",
					})}
				</p>
			) : null}
		</div>
	);
}
