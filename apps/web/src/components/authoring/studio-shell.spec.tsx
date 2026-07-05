// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { StudioShell } from "./studio-shell";

const { useSessionMock, signOutMock, navigateMock, getFeatureRequestsMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		signOutMock: vi.fn(),
		navigateMock: vi.fn(),
		getFeatureRequestsMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock, signOut: signOutMock };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getMyProfile: vi.fn().mockResolvedValue({ image: null }),
		getFeatureRequests: getFeatureRequestsMock,
	};
});

function session(role = "instructor") {
	return {
		data: { user: { id: "u1", name: "Ada Lovelace", role } },
		isPending: false,
	};
}

describe("StudioShell", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		signOutMock.mockReset();
		navigateMock.mockReset();
		getFeatureRequestsMock.mockReset();
		useSessionMock.mockReturnValue(session());
	});

	it("renders the title and children for an allowed instructor", async () => {
		renderWithRouter(
			<StudioShell title="My courses" area="instructor">
				<p>Course list</p>
			</StudioShell>,
		);
		expect(await screen.findByText("My courses")).toBeInTheDocument();
		expect(screen.getByText("Course list")).toBeInTheDocument();
	});

	it("shows the instructors-only gate for a learner", async () => {
		useSessionMock.mockReturnValue(session("learner"));
		renderWithRouter(
			<StudioShell title="My courses" area="instructor">
				<p>Course list</p>
			</StudioShell>,
		);
		expect(await screen.findByText("Instructors only")).toBeInTheDocument();
		expect(screen.queryByText("Course list")).not.toBeInTheDocument();
	});

	it("shows the admins-only gate for an instructor in the admin area", async () => {
		useSessionMock.mockReturnValue(session("instructor"));
		renderWithRouter(
			<StudioShell title="Admin dashboard" area="admin">
				<p>Admin content</p>
			</StudioShell>,
		);
		expect(await screen.findByText("Admins only")).toBeInTheDocument();
	});

	it("signs out and navigates home", async () => {
		const user = userEvent.setup();
		renderWithRouter(
			<StudioShell title="My courses" area="instructor">
				<p>Course list</p>
			</StudioShell>,
		);
		await screen.findByText("My courses");

		await user.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOutMock).toHaveBeenCalled();
		});
		expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
	});

	it("opens and closes the mobile 'More' sheet", async () => {
		const user = userEvent.setup();
		renderWithRouter(
			<StudioShell title="My courses" area="instructor">
				<p>Course list</p>
			</StudioShell>,
		);
		await screen.findByText("My courses");

		await user.click(screen.getByRole("button", { name: "More" }));
		const closeButton = screen.getByRole("button", { name: "Close" });
		expect(closeButton).toBeInTheDocument();

		await user.click(closeButton);
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: "Close" }),
			).not.toBeInTheDocument();
		});
	});

	it("shows a pending-feature badge for an admin with open feature requests", async () => {
		useSessionMock.mockReturnValue(session("admin"));
		getFeatureRequestsMock.mockResolvedValue([
			{ id: "c1", title: "Course 1", isFeatured: false },
			{ id: "c2", title: "Course 2", isFeatured: true },
		]);
		renderWithRouter(
			<StudioShell title="Admin dashboard" area="admin">
				<p>Admin content</p>
			</StudioShell>,
		);
		await screen.findByText("Admin dashboard");
		// The badge renders in both the desktop sidebar and the mobile tab bar,
		// which are both present in the DOM simultaneously (hidden via CSS only).
		const badges = await screen.findAllByText("1");
		expect(badges.length).toBeGreaterThan(0);
	});
});
