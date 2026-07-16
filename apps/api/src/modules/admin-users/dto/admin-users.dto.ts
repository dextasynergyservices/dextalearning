import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ASSIGNABLE_ROLES } from "../admin-users.service";

export class SetRoleDto {
	@ApiProperty({ enum: ASSIGNABLE_ROLES })
	@IsIn(ASSIGNABLE_ROLES)
	role!: (typeof ASSIGNABLE_ROLES)[number];
}

export class SuspendUserDto {
	/**
	 * Shown to the suspended user on every refused request. Optional, but a
	 * suspension without a reason generates support tickets.
	 */
	@ApiPropertyOptional({ maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	reason?: string;
}
