import { type ClipboardEvent, type KeyboardEvent, useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
	/** Current value (0–`length` digits). */
	value: string;
	onChange: (value: string) => void;
	/** Fired when all `length` cells are filled. */
	onComplete?: (value: string) => void;
	length?: number;
	disabled?: boolean;
	autoFocus?: boolean;
	/** Accessible group label (each cell is labelled "digit N of length"). */
	ariaLabel?: string;
	invalid?: boolean;
}

/**
 * Segmented one-time-code input — one box per digit with auto-advance,
 * backspace-to-previous, and full-code paste. Numeric-only; sized for thumbs on
 * mobile. Purely controlled so the parent owns the value.
 */
export function OtpInput({
	value,
	onChange,
	onComplete,
	length = 6,
	disabled = false,
	autoFocus = false,
	ariaLabel = "Verification code",
	invalid = false,
}: OtpInputProps) {
	const refs = useRef<(HTMLInputElement | null)[]>([]);
	const digits = value.split("").slice(0, length);

	const commit = (next: string) => {
		const clean = next.replace(/\D/g, "").slice(0, length);
		onChange(clean);
		if (clean.length === length) onComplete?.(clean);
	};

	const focusCell = (index: number) => {
		const clamped = Math.max(0, Math.min(length - 1, index));
		refs.current[clamped]?.focus();
		refs.current[clamped]?.select();
	};

	const handleInput = (index: number, raw: string) => {
		const digit = raw.replace(/\D/g, "").slice(-1);
		if (!digit) return;
		const chars = value.split("");
		chars[index] = digit;
		const next = chars.join("").slice(0, length);
		commit(next);
		if (index < length - 1) focusCell(index + 1);
	};

	const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Backspace") {
			e.preventDefault();
			const chars = value.split("");
			if (chars[index]) {
				chars[index] = "";
				commit(chars.join(""));
			} else if (index > 0) {
				chars[index - 1] = "";
				commit(chars.join(""));
				focusCell(index - 1);
			}
		} else if (e.key === "ArrowLeft") {
			focusCell(index - 1);
		} else if (e.key === "ArrowRight") {
			focusCell(index + 1);
		}
	};

	const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
		if (!pasted) return;
		commit(pasted);
		focusCell(pasted.length);
	};

	return (
		<fieldset
			className="m-0 flex justify-center gap-2 border-0 p-0 sm:gap-3"
			aria-label={ariaLabel}
		>
			{Array.from({ length }).map((_, i) => (
				<input
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional cells.
					key={i}
					ref={(el) => {
						refs.current[i] = el;
					}}
					type="text"
					inputMode="numeric"
					autoComplete={i === 0 ? "one-time-code" : "off"}
					// biome-ignore lint/a11y/noAutofocus: focusing the first cell when the dialog opens is the expected OTP UX.
					autoFocus={autoFocus && i === 0}
					aria-label={`Digit ${i + 1} of ${length}`}
					maxLength={1}
					disabled={disabled}
					value={digits[i] ?? ""}
					onChange={(e) => handleInput(i, e.target.value)}
					onKeyDown={(e) => handleKeyDown(i, e)}
					onPaste={handlePaste}
					onFocus={(e) => e.target.select()}
					className={cn(
						"size-12 rounded-input border bg-card text-center font-stats text-foreground text-xl outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:size-14",
						invalid ? "border-error" : "border-border",
						disabled && "opacity-50",
					)}
				/>
			))}
		</fieldset>
	);
}
