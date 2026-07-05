import { describe, expect, it } from "vitest";
import {
	forgotSchema,
	loginSchema,
	registerSchema,
	resetPasswordSchema,
	verifySchema,
} from "./auth-schemas";

const validRegister = {
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	password: "Str0ng!Passw0rd",
	confirmPassword: "Str0ng!Passw0rd",
	role: "learner" as const,
};

describe("registerSchema", () => {
	it("accepts a fully valid registration", () => {
		expect(registerSchema.safeParse(validRegister).success).toBe(true);
	});

	it("rejects a password under 12 characters", () => {
		const result = registerSchema.safeParse({
			...validRegister,
			password: "Sh0rt!",
			confirmPassword: "Sh0rt!",
		});
		expect(result.success).toBe(false);
	});

	it("requires an uppercase letter, a number, and a special character", () => {
		expect(
			registerSchema.safeParse({
				...validRegister,
				password: "alllowercase123",
				confirmPassword: "alllowercase123",
			}).success,
		).toBe(false);
		expect(
			registerSchema.safeParse({
				...validRegister,
				password: "NoNumbersHere!",
				confirmPassword: "NoNumbersHere!",
			}).success,
		).toBe(false);
		expect(
			registerSchema.safeParse({
				...validRegister,
				password: "NoSpecial1234",
				confirmPassword: "NoSpecial1234",
			}).success,
		).toBe(false);
	});

	it("rejects mismatched confirm-password, flagged on the confirm field", () => {
		const result = registerSchema.safeParse({
			...validRegister,
			confirmPassword: "Different!Passw0rd1",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
		}
	});

	it("rejects an invalid email", () => {
		const result = registerSchema.safeParse({
			...validRegister,
			email: "not-an-email",
		});
		expect(result.success).toBe(false);
	});

	it("accepts a valid optional phone, and empty/undefined phone", () => {
		expect(
			registerSchema.safeParse({ ...validRegister, phone: "+234 812 345 6789" })
				.success,
		).toBe(true);
		expect(
			registerSchema.safeParse({ ...validRegister, phone: "" }).success,
		).toBe(true);
	});

	it("rejects a malformed phone", () => {
		const result = registerSchema.safeParse({
			...validRegister,
			phone: "not-a-phone!!",
		});
		expect(result.success).toBe(false);
	});

	it("only accepts learner or instructor as the role", () => {
		const result = registerSchema.safeParse({
			...validRegister,
			role: "admin",
		});
		expect(result.success).toBe(false);
	});
});

describe("loginSchema", () => {
	it("accepts a valid email/password pair", () => {
		expect(
			loginSchema.safeParse({ email: "a@b.com", password: "anything" }).success,
		).toBe(true);
	});

	it("rejects an empty password", () => {
		expect(
			loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
		).toBe(false);
	});
});

describe("forgotSchema", () => {
	it("requires a valid email", () => {
		expect(forgotSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
		expect(forgotSchema.safeParse({ email: "nope" }).success).toBe(false);
	});
});

describe("resetPasswordSchema", () => {
	const valid = {
		code: "123456",
		password: "Str0ng!Passw0rd",
		confirmPassword: "Str0ng!Passw0rd",
	};

	it("accepts a valid 6-digit code with matching strong passwords", () => {
		expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
	});

	it("rejects a code that isn't exactly 6 digits", () => {
		expect(
			resetPasswordSchema.safeParse({ ...valid, code: "12345" }).success,
		).toBe(false);
		expect(
			resetPasswordSchema.safeParse({ ...valid, code: "abcdef" }).success,
		).toBe(false);
	});

	it("rejects mismatched passwords", () => {
		expect(
			resetPasswordSchema.safeParse({
				...valid,
				confirmPassword: "Other1!Value",
			}).success,
		).toBe(false);
	});
});

describe("verifySchema", () => {
	it("requires a 6-digit numeric code", () => {
		expect(verifySchema.safeParse({ code: "654321" }).success).toBe(true);
		expect(verifySchema.safeParse({ code: "65432" }).success).toBe(false);
	});
});
