import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
	getHealth() {
		return {
			success: true,
			service: "dextalearning-api",
			timestamp: new Date().toISOString(),
		};
	}
}
