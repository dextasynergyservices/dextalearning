import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsDateString,
	IsIn,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from "class-validator";

export class SaveAnswerDto {
	@ApiProperty()
	@IsUUID()
	questionId!: string;

	@ApiProperty({
		description: "Option text (MCQ), 'true'/'false', or free text.",
	})
	@IsString()
	@MaxLength(5000)
	answer!: string;
}

export class SubmitAttemptDto {
	@ApiPropertyOptional({
		description: "Final answers keyed by question id, merged before grading.",
		type: "object",
		additionalProperties: { type: "string" },
	})
	@IsOptional()
	@IsObject()
	answers?: Record<string, string>;
}

export const ANTI_CHEAT_EVENT_TYPES = [
	"tab_switch",
	"focus_loss",
	"copy_attempt",
	"paste_attempt",
	"right_click",
	"keyboard_shortcut",
	"fullscreen_exit",
	"camera_face_missing",
	"camera_multiple_faces",
	// Reports that the monitor itself couldn't run (§4.6.2) — not an accusation.
	"camera_monitor_unavailable",
	"fast_answer",
	"viewport_change",
	"devtools_open",
] as const;

/**
 * Deliberately NOT including `info`: severity is client-reported, and `info`
 * carries zero penalty (§4.6.2). Accepting it here would let a cheat label a
 * real tab-switch weightless. The server assigns `info` itself, only to system
 * event types — see `resolveSeverity`.
 */
const SEVERITIES = ["low", "medium", "high"] as const;

export class AntiCheatEventDto {
	@ApiProperty({ enum: ANTI_CHEAT_EVENT_TYPES })
	@IsIn(ANTI_CHEAT_EVENT_TYPES)
	eventType!: (typeof ANTI_CHEAT_EVENT_TYPES)[number];

	@ApiPropertyOptional({ enum: SEVERITIES })
	@IsOptional()
	@IsIn(SEVERITIES)
	severity?: (typeof SEVERITIES)[number];

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	occurredAt?: string;

	@ApiPropertyOptional({ type: "object", additionalProperties: true })
	@IsOptional()
	@IsObject()
	metadata?: Record<string, unknown>;

	@ApiPropertyOptional({
		description: "R2 key for a proctoring screenshot (camera).",
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	screenshotKey?: string;
}

export class IngestAntiCheatDto {
	@ApiProperty({ type: [AntiCheatEventDto] })
	@IsArray()
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => AntiCheatEventDto)
	events!: AntiCheatEventDto[];
}
