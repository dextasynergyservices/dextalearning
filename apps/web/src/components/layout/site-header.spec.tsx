// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { SiteHeader } from "./site-header";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", () => ({
	getMyProfile: vi.fn().mockResolvedValue({ image: null }),
}));

describe("SiteHeader", () => {
	it("shows sign-in/get-started links when signed out", async () => {
		useSessionMock.mockReturnValue({ data: null });
		renderWithRouter(<SiteHeader />);
		expect(
			await screen.findByRole("link", { name: "Sign in" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Get started" }),
		).toBeInTheDocument();
	});

	it("shows the account menu instead when signed in", async () => {
		useSessionMock.mockReturnValue({
			data: {
				user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
			},
		});
		renderWithRouter(<SiteHeader />);
		expect(
			await screen.findByRole("button", { name: "Account menu" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Sign in" }),
		).not.toBeInTheDocument();
	});

	it("renders the primary nav links", async () => {
		useSessionMock.mockReturnValue({ data: null });
		renderWithRouter(<SiteHeader />);
		expect(
			await screen.findByRole("link", { name: "Courses" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
	});
});
