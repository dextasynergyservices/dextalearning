// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseDetail } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { CourseSettingsPanel } from "./course-settings-panel";

const { useSessionMock, updateCourseMock, uploadCourseThumbnailMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		updateCourseMock: vi.fn(),
		uploadCourseThumbnailMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		updateCourse: updateCourseMock,
		uploadCourseThumbnail: uploadCourseThumbnailMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/payments-api", () => ({
	getPlatformFeePct: vi
		.fn()
		.mockResolvedValue({ pct: 5, instructorSharePct: 90 }),
}));

function course(overrides: Partial<CourseDetail> = {}): CourseDetail {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		status: "draft",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		createdAt: new Date().toISOString(),
		_count: { modules: 0 },
		price: 5000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		description: "<p>Learn React</p>",
		language: "en",
		estimatedDuration: null,
		hasFinalAssessment: false,
		isFeatured: false,
		featureRequested: false,
		earnBackDeadlineDays: null,
		modules: [],
		...overrides,
	};
}

function learnerSession(role = "instructor") {
	return { data: { user: { id: "u1", role } } };
}

describe("CourseSettingsPanel", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		updateCourseMock.mockReset();
		uploadCourseThumbnailMock.mockReset();
		useSessionMock.mockReturnValue(learnerSession());
	});

	it("renders the pricing and Earn-Back fields for a paid course", () => {
		renderWithProviders(<CourseSettingsPanel course={course()} />);
		expect(screen.getByText("Course settings")).toBeInTheDocument();
		expect(screen.getByText("Paid course")).toBeInTheDocument();
		expect(screen.getByText("Earn-Back")).toBeInTheDocument();
	});

	it("hides pricing fields when the course is free", () => {
		renderWithProviders(
			<CourseSettingsPanel course={course({ isFree: true })} />,
		);
		expect(screen.queryByText("Price")).not.toBeInTheDocument();
		expect(screen.queryByText("Earn-Back")).not.toBeInTheDocument();
	});

	it("shows the Earn-Back preview computed on the post-fee remainder", async () => {
		renderWithProviders(
			<CourseSettingsPanel
				course={course({ isEarnBackEligible: true, earnBackPercentage: 50 })}
			/>,
		);
		// 5% platform fee off ₦5,000 → remainder ₦4,750; 50% earn-back → ₦2,375.
		expect(
			await screen.findByText(
				"Learners can earn back up to ₦2,375 — 50% of ₦4,750 (the price minus the 5% platform fee).",
			),
		).toBeInTheDocument();
	});

	// The creator must see their own side of the deal, not just the learner's.
	it("tells the creator what they keep at a partial Earn-Back %", async () => {
		renderWithProviders(
			<CourseSettingsPanel
				course={course({ isEarnBackEligible: true, earnBackPercentage: 50 })}
			/>,
		);
		// Guaranteed N = ₦4,750 − ₦2,375 = ₦2,375; the creator's 90% = ₦2,137.
		expect(
			await screen.findByText(
				"You keep ₦2,137 of every sale at settlement — 90% of the ₦2,375 that isn't refundable.",
			),
		).toBeInTheDocument();
	});

	it("warns the creator that 100% Earn-Back pays them nothing on success", async () => {
		renderWithProviders(
			<CourseSettingsPanel
				course={course({ isEarnBackEligible: true, earnBackPercentage: 100 })}
			/>,
		);
		expect(
			await screen.findByText(/You earn ₦0 when a learner finishes on time/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/paid only from learners who miss their deadline/),
		).toBeInTheDocument();
	});

	it("shows 'Request featuring' for a non-admin and 'Feature on homepage' for an admin", () => {
		const { unmount } = renderWithProviders(
			<CourseSettingsPanel course={course()} />,
		);
		expect(screen.getByText("Request featuring")).toBeInTheDocument();
		unmount();

		useSessionMock.mockReturnValue(learnerSession("admin"));
		renderWithProviders(<CourseSettingsPanel course={course()} />);
		expect(screen.getByText("Feature on homepage")).toBeInTheDocument();
	});

	it("saves settings and shows a success toast", async () => {
		const { toast } = await import("sonner");
		updateCourseMock.mockResolvedValue(course());
		const user = userEvent.setup();
		renderWithProviders(<CourseSettingsPanel course={course()} />);

		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(updateCourseMock).toHaveBeenCalledWith(
				"c1",
				expect.objectContaining({ isFree: false, currency: "NGN" }),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Settings saved");
	});

	it("uploads a thumbnail and shows a success toast", async () => {
		const { toast } = await import("sonner");
		uploadCourseThumbnailMock.mockResolvedValue({
			thumbnailKey: "k1",
			thumbnailUrl: "https://cdn.example.com/k1.png",
		});
		const user = userEvent.setup();
		const { container } = renderWithProviders(
			<CourseSettingsPanel course={course()} />,
		);

		const input = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		const file = new File(["bytes"], "cover.png", { type: "image/png" });
		await user.upload(input, file);

		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith("Thumbnail updated");
		});
		expect(uploadCourseThumbnailMock).toHaveBeenCalledWith(
			"c1",
			expect.objectContaining({ name: "cover.png" }),
		);
	});
});
