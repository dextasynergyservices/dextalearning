import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SessionGuard } from "../../auth/guards/session.guard";
import { TranslateDto } from "./dto/translate.dto";
import { TranslationService } from "./translation.service";

/** On-demand, cached translation of display text (§11 — read-only). */
@ApiTags("translation")
@ApiCookieAuth("better-auth.session_token")
@Controller("i18n")
@UseGuards(SessionGuard)
export class TranslationController {
	constructor(private readonly translation: TranslationService) {}

	@Post("translate")
	@ApiOperation({
		summary:
			"Translate display text to a language (read-only, cached — never used for grading)",
	})
	async translate(@Body() dto: TranslateDto) {
		return {
			translations: await this.translation.translate(dto.texts, dto.language),
		};
	}
}
