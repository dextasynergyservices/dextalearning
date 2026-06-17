import type { ComponentPropsWithRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FormFieldProps extends ComponentPropsWithRef<"input"> {
	label: string;
	/** i18n key in the `auth` namespace. */
	error?: string;
	hint?: string;
}

export function FormField({
	label,
	error,
	hint,
	id,
	name,
	className,
	...props
}: FormFieldProps) {
	const { t } = useTranslation("auth");
	const inputId = id ?? name;

	return (
		<div>
			<label
				htmlFor={inputId}
				className="mb-1.5 block font-medium text-slate-700 text-sm"
			>
				{label}
			</label>
			<input
				id={inputId}
				name={name}
				aria-invalid={error ? true : undefined}
				className={cn(
					"h-12 w-full rounded-input border bg-white px-3.5 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400 focus:ring-2",
					error
						? "border-error focus:border-error focus:ring-error/20"
						: "border-slate-200 focus:border-brand-primary focus:ring-brand-primary/20",
					className,
				)}
				{...props}
			/>
			{hint && !error ? (
				<p className="mt-1.5 text-slate-400 text-xs">{hint}</p>
			) : null}
			{error ? (
				<p className="mt-1.5 text-error text-sm" role="alert">
					{t(error)}
				</p>
			) : null}
		</div>
	);
}
