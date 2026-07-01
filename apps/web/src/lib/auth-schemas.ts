import { z } from "zod";

// Error messages are i18n keys (in the `auth` namespace), resolved at render
// time by the form fields. Mirrors the server-side rules (blueprint §5.5).

const passwordSchema = z
	.string()
	.min(12, "errors.password_min")
	.regex(/[A-Z]/, "errors.password_uppercase")
	.regex(/[0-9]/, "errors.password_number")
	.regex(/[^A-Za-z0-9]/, "errors.password_special");

const emailSchema = z
	.string()
	.min(1, "errors.email_required")
	.email("errors.email_invalid");

const optionalPhone = z
	.string()
	.optional()
	.refine(
		(value) => !value || /^[+]?[0-9\s-]{7,20}$/.test(value),
		"errors.phone_invalid",
	);

const otpCodeSchema = z
	.string()
	.length(6, "errors.code_length")
	.regex(/^[0-9]+$/, "errors.code_length");

export const registerSchema = z
	.object({
		firstName: z.string().min(1, "errors.first_name_required"),
		lastName: z.string().min(1, "errors.last_name_required"),
		otherNames: z.string().optional(),
		email: emailSchema,
		phone: optionalPhone,
		password: passwordSchema,
		confirmPassword: z.string().min(1, "errors.confirm_required"),
		// No `.default()` here — a default makes zod's input/output types diverge
		// (role optional in, required out), which the zodResolver/useForm generic
		// can't reconcile. The form already sets an initial value via `useForm`'s
		// own `defaultValues: { role: "learner" }`.
		role: z.enum(["learner", "instructor"]),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "errors.password_mismatch",
		path: ["confirmPassword"],
	});

export type RegisterValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "errors.password_min"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const forgotSchema = z.object({ email: emailSchema });
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetPasswordSchema = z
	.object({
		code: otpCodeSchema,
		password: passwordSchema,
		confirmPassword: z.string().min(1, "errors.confirm_required"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "errors.password_mismatch",
		path: ["confirmPassword"],
	});

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const verifySchema = z.object({
	code: otpCodeSchema,
});

export type VerifyValues = z.infer<typeof verifySchema>;
