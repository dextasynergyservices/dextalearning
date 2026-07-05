// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InstructorPublic } from "@/lib/content-api";
import { renderWithProviders, renderWithRouter } from "@/test/render";
import {
	ExpertiseChips,
	InstructorAvatar,
	InstructorByline,
} from "./instructor-byline";

function instructor(
	overrides: Partial<InstructorPublic> = {},
): InstructorPublic {
	return {
		id: "i1",
		name: "Ada Lovelace",
		image: null,
		headline: null,
		bio: null,
		expertiseAreas: [],
		...overrides,
	};
}

describe("InstructorAvatar", () => {
	it("renders initials when there is no image", () => {
		renderWithProviders(<InstructorAvatar instructor={instructor()} />);
		expect(screen.getByText("AL")).toBeInTheDocument();
	});

	it("renders the image when one is present", () => {
		const { container } = renderWithProviders(
			<InstructorAvatar instructor={instructor({ image: "avatar.png" })} />,
		);
		// alt="" is intentional (decorative) — that makes it ARIA role
		// "presentation", not "img", so query the element directly.
		expect(container.querySelector("img")).toHaveAttribute("src", "avatar.png");
	});
});

describe("ExpertiseChips", () => {
	it("renders nothing for an empty list", () => {
		const { container } = renderWithProviders(<ExpertiseChips areas={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("falls back to the raw key for an unmapped area", () => {
		renderWithProviders(<ExpertiseChips areas={["some-custom-area"]} />);
		expect(screen.getByText("some-custom-area")).toBeInTheDocument();
	});
});

describe("InstructorByline", () => {
	it("renders the instructor's name, headline and bio", async () => {
		renderWithRouter(
			<InstructorByline
				instructor={instructor({
					headline: "Senior Engineer",
					bio: "I teach backend systems.",
				})}
			/>,
		);
		expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
		expect(screen.getByText("I teach backend systems.")).toBeInTheDocument();
	});

	it("omits the bio paragraph when there is none", async () => {
		renderWithRouter(<InstructorByline instructor={instructor()} />);
		await screen.findByText("Ada Lovelace");
		expect(
			screen.queryByText("I teach backend systems."),
		).not.toBeInTheDocument();
	});
});
