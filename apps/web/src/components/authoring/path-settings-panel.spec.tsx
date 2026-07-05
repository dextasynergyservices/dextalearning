// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PathDetail } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { PathSettingsPanel } from "./path-settings-panel";

const { useSessionMock, updatePathMock, uploadPathThumbnailMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		updatePathMock: vi.fn(),
		uploadPathThumbnailMock: vi.fn(),
	}),
);

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		updatePath: updatePathMock,
		uploadPathThumbnail: uploadPathThumbnailMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function path(overrides: Partial<PathDetail> = {}): PathDetail {
	return {
		id: "p1",
		title: "Full Stack",
		slug: "full-stack",
		status: "draft",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		estimatedHours: null,
		createdAt: new Date().toISOString(),
		_count: { pathCourses: 0 },
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		description: "<p>Learn full stack</p>",
		outcomeStatement: "<p>Ship a real app</p>",
		estimatedDuration: null,
		earnBackDeadlineDays: null,
		isFeatured: false,
		featureRequested: false,
		introLesson: null,
		pathCourses: [],
		availableCourses: [],
		...overrides,
	};
}

function session(role = "instructor") {
	return { data: { user: { id: "u1", role } } };
}

describe("PathSettingsPanel", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		updatePathMock.mockReset();
		uploadPathThumbnailMock.mockReset();
		useSessionMock.mockReturnValue(session());
	});

	it("renders the pricing and Earn-Back fields for a paid path", () => {
		renderWithProviders(<PathSettingsPanel path={path()} />);
		expect(screen.getByText("Path settings")).toBeInTheDocument();
		expect(screen.getByText("Outcome statement")).toBeInTheDocument();
		// The real locale key overrides the component's "Paid path" fallback text.
		expect(screen.getByText("Paid course")).toBeInTheDocument();
		expect(screen.getByText("Earn-Back")).toBeInTheDocument();
	});

	it("hides pricing fields when the path is free", () => {
		renderWithProviders(<PathSettingsPanel path={path({ isFree: true })} />);
		expect(screen.queryByText("Price")).not.toBeInTheDocument();
		expect(screen.queryByText("Earn-Back")).not.toBeInTheDocument();
	});

	it("shows the Earn-Back preview with the computed refundable amount", () => {
		renderWithProviders(
			<PathSettingsPanel
				path={path({ isEarnBackEligible: true, earnBackPercentage: 20 })}
			/>,
		);
		expect(
			screen.getByText("Learners can earn back 20% — ₦2,000 of ₦10,000."),
		).toBeInTheDocument();
	});

	it("shows 'Request featuring' for a non-admin and 'Feature on homepage' for an admin", () => {
		const { unmount } = renderWithProviders(
			<PathSettingsPanel path={path()} />,
		);
		expect(screen.getByText("Request featuring")).toBeInTheDocument();
		unmount();

		useSessionMock.mockReturnValue(session("admin"));
		renderWithProviders(<PathSettingsPanel path={path()} />);
		expect(screen.getByText("Feature on homepage")).toBeInTheDocument();
	});

	it("saves settings and shows a success toast", async () => {
		const { toast } = await import("sonner");
		updatePathMock.mockResolvedValue(path());
		const user = userEvent.setup();
		renderWithProviders(<PathSettingsPanel path={path()} />);

		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(updatePathMock).toHaveBeenCalledWith(
				"p1",
				expect.objectContaining({ isFree: false, currency: "NGN" }),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Settings saved");
	});

	it("uploads a thumbnail and shows a success toast", async () => {
		const { toast } = await import("sonner");
		uploadPathThumbnailMock.mockResolvedValue({
			thumbnailKey: "k1",
			thumbnailUrl: "https://cdn.example.com/k1.png",
		});
		const user = userEvent.setup();
		const { container } = renderWithProviders(
			<PathSettingsPanel path={path()} />,
		);

		const input = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		const file = new File(["bytes"], "cover.png", { type: "image/png" });
		await user.upload(input, file);

		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith("Thumbnail updated");
		});
		expect(uploadPathThumbnailMock).toHaveBeenCalledWith(
			"p1",
			expect.objectContaining({ name: "cover.png" }),
		);
	});
});
