// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { getSessionMock, assignMock } = vi.hoisted(() => ({
	getSessionMock: vi.fn(),
	assignMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return {
		...actual,
		authClient: { getSession: getSessionMock },
	};
});

beforeEach(() => {
	getSessionMock.mockReset();
	assignMock.mockReset();
	Object.defineProperty(window, "location", {
		writable: true,
		value: { ...window.location, assign: assignMock },
	});
});

describe("ContinuePage", () => {
	it("hard-navigates to the role home when there's no redirect param", async () => {
		getSessionMock.mockResolvedValue({ data: { user: { role: "learner" } } });
		renderRoute("/continue");

		await waitFor(() => {
			expect(assignMock).toHaveBeenCalledWith("/dashboard");
		});
	});

	it("routes an instructor to /instructor", async () => {
		getSessionMock.mockResolvedValue({
			data: { user: { role: "instructor" } },
		});
		renderRoute("/continue");

		await waitFor(() => {
			expect(assignMock).toHaveBeenCalledWith("/instructor");
		});
	});

	it("honours an explicit ?redirect= over the role home", async () => {
		getSessionMock.mockResolvedValue({ data: { user: { role: "learner" } } });
		renderRoute("/continue?redirect=%2Fsearch");

		await waitFor(() => {
			expect(assignMock).toHaveBeenCalledWith("/search");
		});
	});
});
