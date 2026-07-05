// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TranscriptCue } from "@/lib/transcript";
import { renderWithProviders } from "@/test/render";
import { TranscriptPanel } from "./transcript-panel";

const CUES: TranscriptCue[] = [
	{ start: 0, end: 5, text: "Hello and welcome." },
	{ start: 5, end: 10, text: "Let's get started." },
];

describe("TranscriptPanel", () => {
	it("renders the flat text when there are no timed cues", () => {
		renderWithProviders(<TranscriptPanel text="A plain transcript." />);
		expect(screen.getByText("A plain transcript.")).toBeInTheDocument();
		expect(screen.queryByText("Synced")).not.toBeInTheDocument();
	});

	it("renders each cue with its timestamp and a 'Synced' badge when cues are given", () => {
		renderWithProviders(<TranscriptPanel text="" cues={CUES} />);
		expect(screen.getByText("Synced")).toBeInTheDocument();
		expect(screen.getByText("Hello and welcome.")).toBeInTheDocument();
		expect(screen.getByText("0:00")).toBeInTheDocument();
		expect(screen.getByText("0:05")).toBeInTheDocument();
	});

	it("highlights the cue matching the current playback position", () => {
		renderWithProviders(<TranscriptPanel text="" cues={CUES} currentSec={6} />);
		const activeLine = screen.getByText("Let's get started.").closest("button");
		expect(activeLine).toHaveClass("bg-brand-primary/10");
	});

	it("calls onSeek with the cue's start time when a line is clicked", async () => {
		const onSeek = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<TranscriptPanel text="" cues={CUES} onSeek={onSeek} />,
		);

		await user.click(screen.getByText("Let's get started."));
		expect(onSeek).toHaveBeenCalledWith(5);
	});

	it("collapses the panel when the header is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<TranscriptPanel text="" cues={CUES} />);
		expect(screen.getByText("Hello and welcome.")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Transcript/ }));
		expect(screen.queryByText("Hello and welcome.")).not.toBeInTheDocument();
	});
});
