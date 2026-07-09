import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogEventsHandler } from "./catalog.events-handler";
import { CatalogService } from "./catalog.service";

/** Public catalogue read context — published courses for learners (§4). */
@Module({
	controllers: [CatalogController],
	providers: [CatalogService, CatalogEventsHandler],
})
export class CatalogModule {}
