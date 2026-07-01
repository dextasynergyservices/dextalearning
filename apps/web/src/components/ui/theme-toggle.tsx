import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type Theme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: {
	value: Theme;
	icon: typeof Sun;
	key: string;
	fallback: string;
}[] = [
	{ value: "light", icon: Sun, key: "theme.light", fallback: "Light" },
	{ value: "dark", icon: Moon, key: "theme.dark", fallback: "Dark" },
	{ value: "system", icon: Monitor, key: "theme.system", fallback: "System" },
];

/** Three-way light / dark / system theme switch (segmented pill). */
export function ThemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const { t } = useTranslation("common");
	return (
		<div
			className={cn(
				"inline-flex items-center gap-1 rounded-pill border border-border bg-muted p-1",
				className,
			)}
		>
			{OPTIONS.map(({ value, icon: Icon, key, fallback }) => {
				const active = theme === value;
				const label = t(key, { defaultValue: fallback });
				return (
					<button
						key={value}
						type="button"
						aria-pressed={active}
						title={label}
						onClick={() => setTheme(value)}
						className={cn(
							"flex size-8 items-center justify-center rounded-pill transition-colors",
							active
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="size-4" />
						<span className="sr-only">{label}</span>
					</button>
				);
			})}
		</div>
	);
}
