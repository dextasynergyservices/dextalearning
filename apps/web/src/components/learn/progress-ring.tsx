import { cn } from "@/lib/utils";

/**
 * Compact circular progress indicator (SVG) used across the learning hubs for a
 * modern, at-a-glance completion read. Renders the percentage in the centre.
 */
export function ProgressRing({
	value,
	size = 72,
	stroke = 7,
	complete = false,
	className,
}: {
	value: number;
	size?: number;
	stroke?: number;
	complete?: boolean;
	className?: string;
}) {
	const pct = Math.min(100, Math.max(0, value));
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const offset = c - (pct / 100) * c;
	const mid = size / 2;

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className={cn("shrink-0", className)}
			role="img"
			aria-label={`${Math.round(pct)}%`}
		>
			<circle
				cx={mid}
				cy={mid}
				r={r}
				fill="none"
				stroke="currentColor"
				strokeWidth={stroke}
				className="text-slate-100"
			/>
			<circle
				cx={mid}
				cy={mid}
				r={r}
				fill="none"
				stroke="currentColor"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeDasharray={c}
				strokeDashoffset={offset}
				transform={`rotate(-90 ${mid} ${mid})`}
				className={complete ? "text-success" : "text-brand-primary"}
				style={{ transition: "stroke-dashoffset 0.6s ease" }}
			/>
			<text
				x="50%"
				y="50%"
				dominantBaseline="central"
				textAnchor="middle"
				className="fill-slate-900 font-stats font-bold"
				fontSize={size * 0.26}
			>
				{Math.round(pct)}%
			</text>
		</svg>
	);
}
