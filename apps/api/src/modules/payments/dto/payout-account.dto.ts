import { IsString, Matches } from "class-validator";

/** Nigerian bank account for Paystack payout setup (§14.3). */
export class SetPaystackAccountDto {
	@IsString()
	@Matches(/^\d{3,6}$/, { message: "bankCode must be a 3–6 digit code" })
	bankCode!: string;

	@IsString()
	@Matches(/^\d{10}$/, { message: "accountNumber must be 10 digits" })
	accountNumber!: string;
}
