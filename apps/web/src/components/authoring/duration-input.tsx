import { useState } from "react";
import { useTranslation } from "react-i18next";

const PER_UNIT = { day: 1, week: 7, month: 30 } as const;
type Unit = keyof typeof PER_UNIT;

/** Pick the largest unit that divides `days` cleanly, so 14 reads as "2 weeks". */
function splitDays(days: number | null): { value: string; unit: Unit } {
	if (days == null || days <= 0) return { value: "", unit: "day" };
	if (days % PER_UNIT.month === 0) {
		return { value: String(days / PER_UNIT.month), unit: "month" };
	}
	if (days % PER_UNIT.week === 0) {
		return { value: String(days / PER_UNIT.week), unit: "week" };
	}
	return { value: String(days), unit: "day" };
}

/**
 * A duration expressed in the unit a creator actually thinks in (days / weeks /
 * months) but stored as plain days. Empty value ⇒ null ("never"), which is what
 * the retry-policy fields treat as "no reset".
 */
export function DurationInput({
	days,
	onChange,
}: {
	days: number | null;
	onChange: (days: number | null) => void;
}) {
	const { t } = useTranslation("authoring");
	const initial = splitDays(days);
	const [value, setValue] = useState(initial.value);
	const [unit, setUnit] = useState<Unit>(initial.unit);

	const emit = (nextValue: string, nextUnit: Unit) => {
		const n = Number(nextValue.trim());
		onChange(
			nextValue.trim() === "" || !Number.isFinite(n) || n <= 0
				? null
				: Math.round(n * PER_UNIT[nextUnit]),
		);
	};

	return (
		<div className="flex gap-2">
			<input
				type="number"
				min={1}
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					emit(e.target.value, unit);
				}}
				className="h-11 w-full min-w-0 rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
			/>
			<select
				value={unit}
				onChange={(e) => {
					const next = e.target.value as Unit;
					setUnit(next);
					emit(value, next);
				}}
				aria-label={t("duration.unit", { defaultValue: "Unit" })}
				className="h-11 shrink-0 rounded-input border border-border bg-card px-2 text-foreground text-sm outline-none focus:border-brand-primary"
			>
				<option value="day">
					{t("duration.days", { defaultValue: "Days" })}
				</option>
				<option value="week">
					{t("duration.weeks", { defaultValue: "Weeks" })}
				</option>
				<option value="month">
					{t("duration.months", { defaultValue: "Months" })}
				</option>
			</select>
		</div>
	);
}
