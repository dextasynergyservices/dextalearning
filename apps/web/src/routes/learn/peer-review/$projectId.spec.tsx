// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPeerReviews } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listMyPeerReviewsMock, submitPeerReviewMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		listMyPeerReviewsMock: vi.fn(),
		submitPeerReviewMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listMyPeerReviews: listMyPeerReviewsMock,
		submitPeerReview: submitPeerReviewMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function reviews(overrides: Partial<MyPeerReviews> = {}): MyPeerReviews {
	return {
		projectId: "proj1",
		projectTitle: "Build a todo app",
		rubric: [{ id: "r1", label: "Code quality", maxPoints: 10 }],
		passMark: 70,
		required: 2,
		completed: 0,
		reviews: [
			{
				reviewId: "rev1",
				label: "#1",
				textContent: "Here is my peer's write-up.",
				urlSubmission: null,
				files: [],
				done: false,
				myScores: [],
				myFeedback: null,
			},
		],
		...overrides,
	};
}

describe("PeerReviewRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyPeerReviewsMock.mockReset();
		submitPeerReviewMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
	});

	it("renders the project title and a peer submission to review", async () => {
		listMyPeerReviewsMock.mockResolvedValue(reviews());
		renderRoute("/learn/peer-review/proj1");

		expect(await screen.findByText("Build a todo app")).toBeInTheDocument();
		expect(screen.getByText("Here is my peer's write-up.")).toBeInTheDocument();
		expect(screen.getByText("Code quality")).toBeInTheDocument();
	});

	it("shows the empty state when there are no peer submissions yet", async () => {
		listMyPeerReviewsMock.mockResolvedValue(reviews({ reviews: [] }));
		renderRoute("/learn/peer-review/proj1");

		expect(
			await screen.findByText(
				"No peer submissions to review yet — check back soon.",
			),
		).toBeInTheDocument();
	});

	it("submits a review with the entered rubric score and feedback", async () => {
		const { toast } = await import("sonner");
		listMyPeerReviewsMock.mockResolvedValue(reviews());
		submitPeerReviewMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/learn/peer-review/proj1");
		await screen.findByText("Build a todo app");

		const scoreInput = screen.getByDisplayValue("0");
		await user.clear(scoreInput);
		await user.type(scoreInput, "8");
		await user.type(
			screen.getByPlaceholderText("Feedback for your peer…"),
			"Nice work",
		);
		await user.click(screen.getByRole("button", { name: "Submit review" }));

		await waitFor(() => {
			expect(submitPeerReviewMock).toHaveBeenCalledWith("rev1", {
				rubricScores: [{ criterionId: "r1", points: 8 }],
				feedback: "Nice work",
			});
		});
		expect(toast.success).toHaveBeenCalledWith("Review submitted");
	});

	it("disables the score input and hides the submit button for a completed review", async () => {
		listMyPeerReviewsMock.mockResolvedValue(
			reviews({
				reviews: [
					{
						reviewId: "rev1",
						label: "#1",
						textContent: "Done review",
						urlSubmission: null,
						files: [],
						done: true,
						myScores: [{ criterionId: "r1", points: 9 }],
						myFeedback: "Great",
					},
				],
			}),
		);
		renderRoute("/learn/peer-review/proj1");

		expect(await screen.findByText("Reviewed")).toBeInTheDocument();
		expect(screen.getByDisplayValue("9")).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: "Submit review" }),
		).not.toBeInTheDocument();
	});
});
