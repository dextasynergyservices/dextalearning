// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getLessonForEditMock, listAssessmentsMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getLessonForEditMock: vi.fn(),
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
		listAssessments: listAssessmentsMock,
	};
});

describe("AdminLessonEditorRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getLessonForEditMock.mockReset();
		listAssessmentsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
		listAssessmentsMock.mockResolvedValue([]);
	});

	it("renders the admin studio chrome for the lesson editor", async () => {
		getLessonForEditMock.mockResolvedValue({
			id: "l1",
			title: "Intro",
			contentType: "text",
			orderIndex: 0,
			introForPathId: null,
			introForCohortId: null,
			transcriptText: "Hello",
			transcriptCuesJson: null,
			videoKeysJson: null,
			videoDurationSec: null,
			videoThumbnailKey: null,
			audioKey: null,
			audioDurationSec: null,
			audioSizeBytes: null,
			pdfKey: null,
			contentText: null,
			captions: [],
		});
		renderRoute("/admin/lessons/l1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(await screen.findByText("Lesson type")).toBeInTheDocument();
	});
});
