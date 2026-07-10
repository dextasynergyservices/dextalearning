import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	MinLength,
	ValidateIf,
} from "class-validator";

export class ManualAssignDto {
	@ApiProperty({ description: "Learner to move." })
	@IsUUID()
	userId!: string;

	@ApiPropertyOptional({
		description: "Destination group, or null to remove from every group.",
		nullable: true,
	})
	@ValidateIf((o) => o.groupId !== null)
	@IsUUID()
	groupId!: string | null;
}

export class CreateGroupDto {
	@ApiPropertyOptional({ description: "Group name (auto-named when omitted)." })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;
}

export class RenameGroupDto {
	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name!: string;
}

export class SetLeadDto {
	@ApiProperty({ description: "Member to promote to group lead." })
	@IsUUID()
	userId!: string;
}
