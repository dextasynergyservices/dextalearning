// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { signInEmailMock, getSessionMock, magicLinkMock, assignMock } =
	vi.hoisted(() => ({
		signInEmailMock: vi.fn(),
		getSessionMock: vi.fn(),
		magicLinkMock: vi.fn(),
		assignMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return {
		...actual,
		signIn: { email: signInEmailMock },
		authClient: {
			getSession: getSessionMock,
			signIn: { magicLink: magicLinkMock },
		},
		signInWithGoogle: vi.fn(),
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
	signInEmailMock.mockReset();
	getSessionMock.mockReset();
	assignMock.mockReset();
	Object.defineProperty(window, "location", {
		writable: true,
		value: { ...window.location, assign: assignMock },
	});
});

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText("Email"), "ada@example.com");
	await user.type(screen.getByLabelText("Password"), "TestPassword123!");
	await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
	it("renders the form with links to forgot-password and register", async () => {
		renderRoute("/login");
		expect(await screen.findByText("Welcome back")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Forgot password?" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Create an account" }),
		).toBeInTheDocument();
	});

	it("shows an error toast and does not navigate when sign-in fails", async () => {
		const { toast } = await import("sonner");
		signInEmailMock.mockResolvedValueOnce({
			data: null,
			error: { message: "Invalid credentials" },
		});
		const user = userEvent.setup();
		renderRoute("/login");
		await screen.findByText("Welcome back");

		await fillAndSubmit(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
		});
		expect(getSessionMock).not.toHaveBeenCalled();
		expect(assignMock).not.toHaveBeenCalled();
	});

	it("confirms the session via getSession before hard-navigating to the role home", async () => {
		signInEmailMock.mockResolvedValueOnce({
			data: { user: { role: "learner" } },
			error: null,
		});
		getSessionMock.mockResolvedValueOnce({
			data: { user: { role: "learner" } },
		});
		const user = userEvent.setup();
		renderRoute("/login");
		await screen.findByText("Welcome back");

		await fillAndSubmit(user);

		await waitFor(() => {
			expect(assignMock).toHaveBeenCalledWith("/dashboard");
		});
		// The exact regression this guards: getSession is awaited BEFORE the hard
		// navigation, not fired-and-forgotten alongside it.
		expect(getSessionMock).toHaveBeenCalled();
	});

	it("routes an instructor to /instructor instead of the learner dashboard", async () => {
		signInEmailMock.mockResolvedValueOnce({
			data: { user: { role: "instructor" } },
			error: null,
		});
		getSessionMock.mockResolvedValueOnce({
			data: { user: { role: "instructor" } },
		});
		const user = userEvent.setup();
		renderRoute("/login");
		await screen.findByText("Welcome back");

		await fillAndSubmit(user);

		await waitFor(() => {
			expect(assignMock).toHaveBeenCalledWith("/instructor");
		});
	});
});
