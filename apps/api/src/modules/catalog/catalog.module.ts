import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

/** Public catalogue read context — published courses for learners (§4). */
@Module({
	controllers: [CatalogController],
	providers: [CatalogService],
})
export class CatalogModule {}
