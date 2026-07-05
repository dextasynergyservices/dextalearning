// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./require-auth";

const { useSessionMock, navigateMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	navigateMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	useSession: useSessionMock,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

describe("RequireAuth", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		navigateMock.mockReset();
	});

	it("shows a spinner while the session is resolving", () => {
		useSessionMock.mockReturnValue({ data: null, isPending: true });
		const { container } = render(
			<RequireAuth>
				<p>Protected</p>
			</RequireAuth>,
		);
		expect(screen.queryByText("Protected")).not.toBeInTheDocument();
		expect(container.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("redirects to /login once resolved with no session", () => {
		useSessionMock.mockReturnValue({ data: null, isPending: false });
		render(
			<RequireAuth>
				<p>Protected</p>
			</RequireAuth>,
		);
		expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
		expect(screen.queryByText("Protected")).not.toBeInTheDocument();
	});

	it("renders children once authenticated", () => {
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1" } },
			isPending: false,
		});
		render(
			<RequireAuth>
				<p>Protected</p>
			</RequireAuth>,
		);
		expect(screen.getByText("Protected")).toBeInTheDocument();
		expect(navigateMock).not.toHaveBeenCalled();
	});
});
