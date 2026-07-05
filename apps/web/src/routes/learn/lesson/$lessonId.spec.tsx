// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonContext } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getLessonContextMock,
	reportLessonProgressMock,
	getMyProfileMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getLessonContextMock: vi.fn(),
	reportLessonProgressMock: vi.fn(),
	getMyProfileMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getLessonContext: getLessonContextMock,
		reportLessonProgress: reportLessonProgressMock,
		getMyProfile: getMyProfileMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

// LessonPlayer wraps real <video>/<audio> via the third-party Plyr library,
// which jsdom can't meaningfully support (see the component-level test skip
// for video-player/audio-player) — stub it so this route's own completion
// tracking/navigation logic (the actual business logic) is what's under test.
vi.mock("@/components/player/lesson-player", () => ({
	LessonPlayer: ({ title }: { title: string }) => (
		<div data-testid="lesson-player">{title}</div>
	),
}));

function context(overrides: Partial<LessonContext> = {}): LessonContext {
	return {
		lesson: {
			id: "l2",
			title: "Setup",
			contentType: "video",
			minVideoWatchPct: 80,
			hasPreQuiz: false,
			hasPostQuiz: false,
		},
		course: { id: "c1", title: "React Basics" },
		lessons: [
			{
				id: "l1",
				title: "Intro",
				contentType: "video",
				moduleTitle: "Getting started",
				done: true,
			},
			{
				id: "l2",
				title: "Setup",
				contentType: "video",
				moduleTitle: "Getting started",
				done: false,
			},
		],
		preQuiz: null,
		postQuiz: null,
		resumePct: 0,
		prevLessonId: "l1",
		nextLessonId: null,
		position: { index: 2, total: 2 },
		done: false,
		...overrides,
	};
}

describe("LessonRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getLessonContextMock.mockReset();
		reportLessonProgressMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
		reportLessonProgressMock.mockResolvedValue({
			lessonId: "l2",
			watchedPct: 0,
			done: false,
			course: {} as never,
		});
	});

	it("renders the lesson title and the completion checklist", async () => {
		getLessonContextMock.mockResolvedValue(context());
		renderRoute("/learn/lesson/l2");

		expect(
			await screen.findByRole("heading", { name: "Setup" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("At least 80% required to complete."),
		).toBeInTheDocument();
	});

	it("shows the completed banner and disables the 'Previous' button appropriately", async () => {
		getLessonContextMock.mockResolvedValue(context({ done: true }));
		renderRoute("/learn/lesson/l2");

		expect(
			await screen.findByText("Completed — well done!"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled();
	});

	it("disables 'Previous' when there's no earlier lesson", async () => {
		getLessonContextMock.mockResolvedValue(context({ prevLessonId: null }));
		renderRoute("/learn/lesson/l2");

		expect(
			await screen.findByRole("heading", { name: "Setup" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
	});

	it("shows 'Back to course' as the next action on the last lesson", async () => {
		getLessonContextMock.mockResolvedValue(
			context({ nextLessonId: null, done: true }),
		);
		renderRoute("/learn/lesson/l2");

		expect(
			await screen.findByRole("button", { name: /Back to course/ }),
		).toBeInTheDocument();
	});

	it("opens the mobile lesson list sheet", async () => {
		getLessonContextMock.mockResolvedValue(context());
		const user = userEvent.setup();
		renderRoute("/learn/lesson/l2");
		await screen.findByRole("heading", { name: "Setup" });

		await user.click(screen.getByRole("button", { name: "Lessons" }));

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
		});
	});
});
