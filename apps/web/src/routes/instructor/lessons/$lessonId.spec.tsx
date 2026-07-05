// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getLessonForEditMock,
	updateLessonMock,
	updateTranscriptMock,
	listAssessmentsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getLessonForEditMock: vi.fn(),
	updateLessonMock: vi.fn(),
	updateTranscriptMock: vi.fn(),
	listAssessmentsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getLessonForEdit: getLessonForEditMock,
		updateLesson: updateLessonMock,
		updateTranscript: updateTranscriptMock,
		listAssessments: listAssessmentsMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function lesson(overrides: Record<string, unknown> = {}) {
	return {
		id: "l1",
		title: "Intro",
		contentType: "text" as const,
		orderIndex: 0,
		introForPathId: null,
		introForCohortId: null,
		transcriptText: null,
		transcriptCuesJson: null,
		videoKeysJson: null,
		videoDurationSec: null,
		videoThumbnailKey: null,
		audioKey: null,
		audioDurationSec: null,
		audioSizeBytes: null,
		pdfKey: null,
		contentText: null,
		minVideoWatchPct: 80,
		hasPreQuiz: false,
		hasPostQuiz: false,
		postQuizPassMark: 70,
		isPreview: false,
		captions: [],
		...overrides,
	};
}

describe("InstructorLessonEditorRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getLessonForEditMock.mockReset();
		updateLessonMock.mockReset();
		updateTranscriptMock.mockReset();
		listAssessmentsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
		listAssessmentsMock.mockResolvedValue([]);
	});

	it("renders the lesson type selector and the transcript-required warning when blank", async () => {
		getLessonForEditMock.mockResolvedValue(lesson());
		renderRoute("/instructor/lessons/l1");

		expect(await screen.findByText("Lesson type")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Add a transcript — the course can't be published until every lesson has one (§4.2).",
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Save transcript" }),
		).toBeDisabled();
	});

	it("changes the lesson content type", async () => {
		getLessonForEditMock.mockResolvedValue(lesson());
		updateLessonMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/lessons/l1");
		await screen.findByText("Lesson type");

		await user.click(screen.getByRole("button", { name: "Video" }));

		await waitFor(() => {
			expect(updateLessonMock).toHaveBeenCalledWith("l1", {
				contentType: "video",
			});
		});
	});

	it("saves the transcript once text is entered", async () => {
		const { toast } = await import("sonner");
		getLessonForEditMock.mockResolvedValue(lesson());
		updateTranscriptMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/lessons/l1");
		await screen.findByText("Lesson type");

		await user.type(
			screen.getByPlaceholderText("Paste or type the full transcript…"),
			"Hello world",
		);
		await user.click(screen.getByRole("button", { name: "Save transcript" }));

		await waitFor(() => {
			expect(updateTranscriptMock).toHaveBeenCalledWith("l1", "Hello world");
		});
		expect(toast.success).toHaveBeenCalledWith("Saved");
	});

	it("toggles the free-preview switch", async () => {
		getLessonForEditMock.mockResolvedValue(lesson());
		updateLessonMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/lessons/l1");
		await screen.findByText("Lesson type");

		await user.click(screen.getByRole("switch", { name: "Free preview" }));

		await waitFor(() => {
			expect(updateLessonMock).toHaveBeenCalledWith("l1", { isPreview: true });
		});
	});

	it("shows the AssessmentLauncher once the post-lesson quiz is enabled", async () => {
		getLessonForEditMock.mockResolvedValue(lesson());
		updateLessonMock.mockResolvedValue(lesson({ hasPostQuiz: true }));
		const user = userEvent.setup();
		renderRoute("/instructor/lessons/l1");
		await screen.findByText("Lesson type");

		await user.click(screen.getByRole("switch", { name: "Post-lesson quiz" }));

		await waitFor(() => {
			expect(updateLessonMock).toHaveBeenCalledWith("l1", {
				hasPostQuiz: true,
			});
		});
	});

	it("shows the load-failed message when the lesson fails to fetch", async () => {
		getLessonForEditMock.mockRejectedValue(new Error("Not found"));
		renderRoute("/instructor/lessons/l1");

		expect(
			await screen.findByText("Lesson could not be loaded"),
		).toBeInTheDocument();
	});
});
