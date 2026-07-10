import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsDefined,
	IsNotEmpty,
	IsObject,
	IsString,
	MaxLength,
	ValidateNested,
} from "class-validator";

class PushKeysDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	p256dh!: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	auth!: string;
}

export class SubscribePushDto {
	@ApiProperty({ description: "The PushSubscription endpoint URL." })
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	endpoint!: string;

	@ApiProperty({ type: PushKeysDto })
	@IsDefined()
	@IsObject()
	@ValidateNested()
	@Type(() => PushKeysDto)
	keys!: PushKeysDto;
}

export class UnsubscribePushDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	endpoint!: string;
}
