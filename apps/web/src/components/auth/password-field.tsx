import { Eye, EyeOff } from "lucide-react";
import { type ComponentPropsWithRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface PasswordFieldProps extends ComponentPropsWithRef<"input"> {
	label: string;
	error?: string;
	hint?: string;
}

export function PasswordField({
	label,
	error,
	hint,
	id,
	name,
	className,
	...props
}: PasswordFieldProps) {
	const { t } = useTranslation("auth");
	const [show, setShow] = useState(false);
	const inputId = id ?? name;

	return (
		<div>
			<label
				htmlFor={inputId}
				className="mb-1.5 block font-medium text-slate-700 text-sm"
			>
				{label}
			</label>
			<div className="relative">
				<input
					id={inputId}
					name={name}
					type={show ? "text" : "password"}
					aria-invalid={error ? true : undefined}
					className={cn(
						"h-12 w-full rounded-input border bg-white pr-11 pl-3.5 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400 focus:ring-2",
						error
							? "border-error focus:border-error focus:ring-error/20"
							: "border-slate-200 focus:border-brand-primary focus:ring-brand-primary/20",
						className,
					)}
					{...props}
				/>
				<button
					type="button"
					onClick={() => setShow((value) => !value)}
					aria-label={t(show ? "hide_password" : "show_password")}
					className="-translate-y-1/2 absolute top-1/2 right-2.5 flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
				>
					{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
				</button>
			</div>
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
