// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { ContactSection } from "./contact-section";

describe("ContactSection", () => {
	it("renders the heading and the three contact cards", async () => {
		renderWithRouter(<ContactSection />);
		expect(
			await screen.findByText("We'd love to hear from you"),
		).toBeInTheDocument();
		expect(screen.getByText("Email us")).toBeInTheDocument();
		expect(screen.getByText("Join the community")).toBeInTheDocument();
		expect(screen.getByText("Help & support")).toBeInTheDocument();
	});

	it("mails-to the real support address for the email card", async () => {
		renderWithRouter(<ContactSection />);
		await screen.findByText("We'd love to hear from you");
		expect(screen.getByText("Email us").closest("a")).toHaveAttribute(
			"href",
			"mailto:hello@dextalearning.com",
		);
	});

	it("links the community card to /community", async () => {
		renderWithRouter(<ContactSection />);
		await screen.findByText("We'd love to hear from you");
		expect(screen.getByText("Join the community").closest("a")).toHaveAttribute(
			"href",
			"/community",
		);
	});
});
