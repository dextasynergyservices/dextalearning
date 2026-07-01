import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsEmail,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";
import { Match } from "../../common/validators/match.decorator";

export class RegisterDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	firstName!: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	lastName!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	otherNames?: string;

	@ApiProperty()
	@IsEmail({}, { message: "A valid email is required" })
	email!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(20)
	phone?: string;

	@ApiProperty()
	@IsString()
	@MinLength(12, { message: "Password must be at least 12 characters" })
	@MaxLength(128)
	@Matches(/[A-Z]/, { message: "Password needs at least one uppercase letter" })
	@Matches(/[0-9]/, { message: "Password needs at least one number" })
	@Matches(/[^A-Za-z0-9]/, {
		message: "Password needs at least one special character",
	})
	password!: string;

	@ApiProperty()
	@IsString()
	@Match("password", { message: "Passwords do not match" })
	confirmPassword!: string;

	@ApiPropertyOptional({
		enum: ["learner", "instructor"],
		description: "Self-service roles only; clamped server-side.",
	})
	@IsOptional()
	@IsIn(["learner", "instructor"])
	role?: "learner" | "instructor";
}
