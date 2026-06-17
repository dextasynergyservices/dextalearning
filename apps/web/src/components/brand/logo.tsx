import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface LogoProps {
	className?: string;
	/** Accent half color — defaults to brand primary; use a light tone on dark surfaces. */
	accentClassName?: string;
	asLink?: boolean;
}

export function Logo({
	className,
	accentClassName = "text-brand-primary",
	asLink = true,
}: LogoProps) {
	const content = (
		<span
			className={cn(
				"font-display text-2xl leading-none tracking-tight",
				className,
			)}
		>
			Dexta<span className={accentClassName}>Learning</span>
		</span>
	);

	if (!asLink) return content;

	return (
		<Link to="/" aria-label="DextaLearning home" className="inline-flex">
			{content}
		</Link>
	);
}
