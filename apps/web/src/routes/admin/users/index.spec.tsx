// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUserList, AdminUserRow } from "@/lib/admin-users-api";
import { renderWithProviders } from "@/test/render";

const {
	listMock,
	setRoleMock,
	suspendMock,
	restoreMock,
	signOutMock,
	sessionMock,
} = vi.hoisted(() => ({
	listMock: vi.fn(),
	setRoleMock: vi.fn(),
	suspendMock: vi.fn(),
	restoreMock: vi.fn(),
	signOutMock: vi.fn(),
	sessionMock: vi.fn(),
}));

vi.mock("@/lib/admin-users-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/admin-users-api")>();
	return {
		...actual,
		listAdminUsers: listMock,
		setUserRole: setRoleMock,
		suspendUser: suspendMock,
		restoreUser: restoreMock,
		signOutUserEverywhere: signOutMock,
	};
});

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: sessionMock };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/authoring/studio-shell", () => ({
	StudioShell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

const { AdminUsersPage } = await import("./index").then((m) => ({
	AdminUsersPage: m.Route.options.component as () => ReactElement,
}));

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
	return {
		id: "u1",
		name: "Amara Okafor",
		email: "amara@example.com",
		role: "learner",
		image: null,
		emailVerified: true,
		phoneVerified: false,
		suspendedAt: null,
		suspendedReason: null,
		joinedAt: "2026-01-10T00:00:00.000Z",
		createdCount: 0,
		enrolmentCount: 3,
		...overrides,
	};
}

function list(rows: AdminUserRow[]): AdminUserList {
	return {
		rows,
		total: rows.length,
		page: 1,
		pageSize: 25,
		roleCounts: { learner: 1, instructor: 0, admin: 1 },
	};
}

/**
 * The row actions are a dropdown on desktop and a bottom sheet on mobile, and
 * `useIsMobile` reads `matchMedia` — which the shared setup stubs to always
 * return `matches: false`, i.e. permanently mobile. Drive it explicitly so both
 * branches are actually covered rather than one silently never running.
 */
function setViewport(kind: "desktop" | "mobile") {
	window.matchMedia = ((query: string) => ({
		matches: kind === "desktop" && query.includes("min-width: 640px"),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	})) as unknown as typeof window.matchMedia;
}

/** Open the first row's ⋯ menu and return a scope over it. */
async function openMenu() {
	await userEvent.click(
		(await screen.findAllByRole("button", { name: /Actions for/ }))[0],
	);
	return within(await screen.findByRole("menu"));
}

describe("Admin users page (§8.7)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setViewport("desktop");
		sessionMock.mockReturnValue({
			data: { user: { id: "me", role: "admin" } },
		});
		listMock.mockResolvedValue(list([row()]));
		signOutMock.mockResolvedValue({ revoked: 2 });
	});

	it("lists users with their role and activity", async () => {
		renderWithProviders(<AdminUsersPage />);
		expect((await screen.findAllByText("Amara Okafor")).length).toBeGreaterThan(
			0,
		);
		expect(screen.getAllByText("amara@example.com").length).toBeGreaterThan(0);
		expect(screen.getAllByText(/3 enrolments/).length).toBeGreaterThan(0);
	});

	it("changes a role through the select", async () => {
		setRoleMock.mockResolvedValue(row({ role: "instructor" }));
		renderWithProviders(<AdminUsersPage />);
		await screen.findAllByText("Amara Okafor");

		const select = screen.getAllByLabelText("Role")[0];
		await userEvent.selectOptions(select, "instructor");

		await waitFor(() =>
			expect(setRoleMock).toHaveBeenCalledWith("u1", "instructor"),
		);
	});

	/**
	 * The invariant is enforced server-side, but the UI shouldn't offer an
	 * action that always fails — self-demotion locks you out of this very page.
	 */
	it("won't let an admin act on their own account", async () => {
		listMock.mockResolvedValue(
			list([row({ id: "me", name: "Me Admin", role: "admin" })]),
		);
		renderWithProviders(<AdminUsersPage />);
		await screen.findAllByText("Me Admin");

		expect(screen.getAllByLabelText("Role")[0]).toBeDisabled();

		// Harmless items stay; anything touching your own access is withheld,
		// matching the server's refusal rather than offering a button that 403s.
		const menu = await openMenu();
		expect(menu.getByRole("menuitem", { name: "Copy email" })).toBeVisible();
		expect(menu.queryByRole("menuitem", { name: "Suspend" })).toBeNull();
		expect(
			menu.queryByRole("menuitem", { name: "Sign out everywhere" }),
		).toBeNull();
	});

	/** Facilitation is per-cohort (§4.7) — never globally grantable. */
	it("shows a facilitator's role but won't let it be reassigned", async () => {
		listMock.mockResolvedValue(list([row({ role: "facilitator" })]));
		renderWithProviders(<AdminUsersPage />);
		await screen.findAllByText("Amara Okafor");

		expect(screen.getAllByLabelText("Role")[0]).toBeDisabled();
	});

	it("requires confirmation and sends the reason when suspending", async () => {
		suspendMock.mockResolvedValue(row({ suspendedAt: "2026-07-15T00:00:00Z" }));
		renderWithProviders(<AdminUsersPage />);
		await screen.findAllByText("Amara Okafor");

		const menu = await openMenu();
		await userEvent.click(menu.getByRole("menuitem", { name: "Suspend" }));

		const dialog = within(await screen.findByRole("dialog"));
		await userEvent.type(dialog.getByLabelText(/reason/i), "Repeated spam");
		await userEvent.click(dialog.getByRole("button", { name: "Suspend" }));

		await waitFor(() =>
			expect(suspendMock).toHaveBeenCalledWith("u1", "Repeated spam"),
		);
	});

	it("tells the admin why a suspended user is suspended", async () => {
		listMock.mockResolvedValue(
			list([
				row({
					suspendedAt: "2026-07-15T00:00:00Z",
					suspendedReason: "Chargeback fraud",
				}),
			]),
		);
		renderWithProviders(<AdminUsersPage />);

		expect(
			(await screen.findAllByText(/Suspended — Chargeback fraud/)).length,
		).toBeGreaterThan(0);
		const menu = await openMenu();
		expect(menu.getByRole("menuitem", { name: "Restore" })).toBeVisible();
	});

	it("restores a suspended user", async () => {
		listMock.mockResolvedValue(
			list([row({ suspendedAt: "2026-07-15T00:00:00Z" })]),
		);
		restoreMock.mockResolvedValue(row());
		renderWithProviders(<AdminUsersPage />);
		await screen.findAllByText("Amara Okafor");

		const menu = await openMenu();
		await userEvent.click(menu.getByRole("menuitem", { name: "Restore" }));
		await waitFor(() => expect(restoreMock).toHaveBeenCalledWith("u1"));
	});

	it("searches by name or email", async () => {
		renderWithProviders(<AdminUsersPage />);
		await screen.findAllByText("Amara Okafor");

		await userEvent.type(screen.getByLabelText(/search by name/i), "amara");

		await waitFor(() =>
			expect(listMock).toHaveBeenCalledWith(
				expect.objectContaining({ search: "amara" }),
			),
		);
	});

	describe("row actions", () => {
		it("copies the email to the clipboard", async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, { clipboard: { writeText } });
			renderWithProviders(<AdminUsersPage />);
			await screen.findAllByText("Amara Okafor");

			const menu = await openMenu();
			await userEvent.click(menu.getByRole("menuitem", { name: "Copy email" }));

			await waitFor(() =>
				expect(writeText).toHaveBeenCalledWith("amara@example.com"),
			);
		});

		/** Only instructors have a public page — a learner link would 404. */
		it("offers the public profile for instructors only", async () => {
			renderWithProviders(<AdminUsersPage />);
			await screen.findAllByText("Amara Okafor");
			expect(
				(await openMenu()).queryByRole("menuitem", {
					name: "View public profile",
				}),
			).toBeNull();
		});

		it("offers the public profile when the user is an instructor", async () => {
			listMock.mockResolvedValue(list([row({ role: "instructor" })]));
			renderWithProviders(<AdminUsersPage />);
			await screen.findAllByText("Amara Okafor");

			expect(
				(await openMenu()).getByRole("menuitem", {
					name: "View public profile",
				}),
			).toBeVisible();
		});

		it("signs a user out everywhere without suspending them", async () => {
			renderWithProviders(<AdminUsersPage />);
			await screen.findAllByText("Amara Okafor");

			const menu = await openMenu();
			await userEvent.click(
				menu.getByRole("menuitem", { name: "Sign out everywhere" }),
			);

			await waitFor(() => expect(signOutMock).toHaveBeenCalledWith("u1"));
			// It is help, not punishment: nothing about their access changes.
			expect(suspendMock).not.toHaveBeenCalled();
		});

		/** A suspended user's sessions are already gone — the item would be a no-op. */
		it("doesn't offer sign-out for an already-suspended user", async () => {
			listMock.mockResolvedValue(
				list([row({ suspendedAt: "2026-07-15T00:00:00Z" })]),
			);
			renderWithProviders(<AdminUsersPage />);
			await screen.findAllByText("Amara Okafor");

			expect(
				(await openMenu()).queryByRole("menuitem", {
					name: "Sign out everywhere",
				}),
			).toBeNull();
		});

		/** The mobile branch is a different interaction, so it gets its own drive. */
		it("opens a bottom sheet with the same actions on mobile", async () => {
			setViewport("mobile");
			restoreMock.mockResolvedValue(row());
			listMock.mockResolvedValue(
				list([row({ suspendedAt: "2026-07-15T00:00:00Z" })]),
			);
			renderWithProviders(<AdminUsersPage />);
			await screen.findAllByText("Amara Okafor");

			const menu = await openMenu();
			await userEvent.click(menu.getByRole("menuitem", { name: "Restore" }));
			await waitFor(() => expect(restoreMock).toHaveBeenCalledWith("u1"));
		});
	});
});
