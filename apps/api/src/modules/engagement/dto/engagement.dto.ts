import { ArrayMaxSize, IsArray, IsString } from "class-validator";

export class MarkBadgesSeenDto {
	@IsArray()
	@IsString({ each: true })
	@ArrayMaxSize(24)
	keys!: string[];
}
