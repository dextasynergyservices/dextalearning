// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { AccountMenu } from "./account-menu";

const { useSessionMock, signOutMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	signOutMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock, signOut: signOutMock };
});

vi.mock("@/lib/content-api", () => ({
	getMyProfile: vi.fn().mockResolvedValue({ image: null }),
}));

function learnerSession() {
	return {
		data: {
			user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
		},
	};
}

describe("AccountMenu", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		signOutMock.mockReset();
	});

	it("renders nothing when there's no session", async () => {
		useSessionMock.mockReturnValue({ data: null });
		const { container } = renderWithRouter(<AccountMenu />);
		await new Promise((r) => setTimeout(r, 0));
		expect(container.querySelector("button")).not.toBeInTheDocument();
	});

	it("shows initials and stays closed until the trigger is clicked", async () => {
		useSessionMock.mockReturnValue(learnerSession());
		renderWithRouter(<AccountMenu />);

		expect(await screen.findByText("AL")).toBeInTheDocument();
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
	});

	it("opens the menu on click, showing the user's name and email", async () => {
		useSessionMock.mockReturnValue(learnerSession());
		const user = userEvent.setup();
		renderWithRouter(<AccountMenu />);

		await user.click(
			await screen.findByRole("button", { name: "Account menu" }),
		);
		expect(screen.getByRole("menu")).toBeInTheDocument();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("ada@example.com")).toBeInTheDocument();
	});

	it("closes the menu on Escape", async () => {
		useSessionMock.mockReturnValue(learnerSession());
		const user = userEvent.setup();
		renderWithRouter(<AccountMenu />);

		await user.click(
			await screen.findByRole("button", { name: "Account menu" }),
		);
		expect(screen.getByRole("menu")).toBeInTheDocument();

		await user.keyboard("{Escape}");
		// AnimatePresence keeps the menu mounted through its exit transition —
		// wait for that to finish rather than asserting synchronously.
		await waitFor(() => {
			expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		});
	});

	it("calls signOut when 'Sign out' is clicked", async () => {
		useSessionMock.mockReturnValue(learnerSession());
		signOutMock.mockResolvedValue(undefined);
		const user = userEvent.setup();
		renderWithRouter(<AccountMenu />);

		await user.click(
			await screen.findByRole("button", { name: "Account menu" }),
		);
		await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

		expect(signOutMock).toHaveBeenCalledOnce();
	});
});
