// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { TutorPanel } from "./tutor-panel";

const { askTutorStreamMock } = vi.hoisted(() => ({
	askTutorStreamMock: vi.fn(),
}));

vi.mock("@/lib/tutor-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/tutor-api")>();
	return { ...actual, askTutorStream: askTutorStreamMock };
});

/** Streams `answer` to the onDelta callback in one chunk, then resolves. */
function streamsAnswer(answer: string) {
	return async (
		_lessonId: string,
		_q: string,
		_history: unknown,
		onDelta: (t: string) => void,
	) => {
		onDelta(answer);
		return answer;
	};
}

describe("TutorPanel", () => {
	beforeEach(() => {
		askTutorStreamMock.mockReset();
	});

	it("stays collapsed until opened, then shows suggested prompts", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<TutorPanel lessonId="l1" lessonTitle="Big-O basics" />,
		);

		expect(
			screen.getByText("Answers grounded in this lesson"),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Your question")).not.toBeInTheDocument();

		await user.click(screen.getByText("Ask the AI tutor"));

		expect(screen.getByLabelText("Your question")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Summarize this lesson" }),
		).toBeInTheDocument();
	});

	it("streams a question's answer into the thread", async () => {
		askTutorStreamMock.mockImplementation(
			streamsAnswer("Big-O measures how runtime grows."),
		);
		const user = userEvent.setup();
		renderWithProviders(
			<TutorPanel lessonId="l1" lessonTitle="Big-O basics" />,
		);

		await user.click(screen.getByText("Ask the AI tutor"));
		await user.type(screen.getByLabelText("Your question"), "What is Big-O?");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() =>
			expect(
				screen.getByText("Big-O measures how runtime grows."),
			).toBeInTheDocument(),
		);
		expect(askTutorStreamMock).toHaveBeenCalledWith(
			"l1",
			"What is Big-O?",
			[],
			expect.any(Function),
		);
	});

	it("passes prior turns as history on the next question", async () => {
		askTutorStreamMock
			.mockImplementationOnce(streamsAnswer("First answer."))
			.mockImplementationOnce(streamsAnswer("Second answer."));
		const user = userEvent.setup();
		renderWithProviders(
			<TutorPanel lessonId="l1" lessonTitle="Big-O basics" />,
		);

		await user.click(screen.getByText("Ask the AI tutor"));
		const input = screen.getByLabelText("Your question");
		await user.type(input, "Q1");
		await user.click(screen.getByRole("button", { name: "Send" }));
		await screen.findByText("First answer.");

		await user.type(input, "Q2");
		await user.click(screen.getByRole("button", { name: "Send" }));
		await screen.findByText("Second answer.");

		expect(askTutorStreamMock).toHaveBeenLastCalledWith(
			"l1",
			"Q2",
			[
				{ role: "user", content: "Q1" },
				{ role: "assistant", content: "First answer." },
			],
			expect.any(Function),
		);
	});

	it("shows an error bubble when the tutor fails", async () => {
		askTutorStreamMock.mockRejectedValue(new Error("boom"));
		const user = userEvent.setup();
		renderWithProviders(
			<TutorPanel lessonId="l1" lessonTitle="Big-O basics" />,
		);

		await user.click(screen.getByText("Ask the AI tutor"));
		await user.type(screen.getByLabelText("Your question"), "Q?");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() =>
			expect(
				screen.getByText("The tutor couldn't answer. Please try again."),
			).toBeInTheDocument(),
		);
	});
});
