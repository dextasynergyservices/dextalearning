// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { MobileAppBar } from "./mobile-app-bar";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

describe("MobileAppBar", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		useSessionMock.mockReturnValue({ data: null });
	});

	it("shows the logo when no title is given", async () => {
		renderWithRouter(<MobileAppBar />);
		expect(
			await screen.findByLabelText("DextaLearning home"),
		).toBeInTheDocument();
	});

	it("shows a page title instead of the logo when one is given", async () => {
		renderWithRouter(<MobileAppBar title="Course Settings" />);
		expect(await screen.findByText("Course Settings")).toBeInTheDocument();
		expect(
			screen.queryByLabelText("DextaLearning home"),
		).not.toBeInTheDocument();
	});

	it("hides the back button by default", async () => {
		renderWithRouter(<MobileAppBar />);
		await screen.findByLabelText("DextaLearning home");
		expect(
			screen.queryByRole("button", { name: "Back" }),
		).not.toBeInTheDocument();
	});

	it("shows the back button when showBack is set", async () => {
		renderWithRouter(<MobileAppBar showBack />);
		expect(
			await screen.findByRole("button", { name: "Back" }),
		).toBeInTheDocument();
	});

	it("links to /login when signed out", async () => {
		renderWithRouter(<MobileAppBar />);
		expect(await screen.findByLabelText("Sign in")).toBeInTheDocument();
	});

	it("shows account initials when signed in with no avatar image", async () => {
		useSessionMock.mockReturnValue({
			data: { user: { name: "Ada Lovelace", image: null } },
		});
		renderWithRouter(<MobileAppBar />);
		expect(await screen.findByText("A")).toBeInTheDocument();
	});
});
