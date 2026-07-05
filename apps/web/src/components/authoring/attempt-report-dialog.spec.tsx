// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptReport } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { AttemptReportDialog } from "./attempt-report-dialog";

const {
	getAttemptReportMock,
	acceptAttemptMock,
	invalidateAttemptMock,
	escalateAttemptMock,
} = vi.hoisted(() => ({
	getAttemptReportMock: vi.fn(),
	acceptAttemptMock: vi.fn(),
	invalidateAttemptMock: vi.fn(),
	escalateAttemptMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getAttemptReport: getAttemptReportMock,
		acceptAttempt: acceptAttemptMock,
		invalidateAttempt: invalidateAttemptMock,
		escalateAttempt: escalateAttemptMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function report(overrides: Partial<AttemptReport> = {}): AttemptReport {
	return {
		id: "att1",
		attemptNumber: 1,
		userName: "Ada Lovelace",
		userEmail: "ada@example.com",
		submittedAt: "2026-06-01T10:00:00.000Z",
		score: 82,
		passed: true,
		autoSubmitted: false,
		integrityScore: 92,
		flagCount: 0,
		ipAddress: null,
		userAgent: null,
		invalidated: false,
		invalidatedReason: null,
		escalated: false,
		escalatedReason: null,
		events: [],
		...overrides,
	};
}

describe("AttemptReportDialog", () => {
	beforeEach(() => {
		getAttemptReportMock.mockReset();
		acceptAttemptMock.mockReset();
		invalidateAttemptMock.mockReset();
		escalateAttemptMock.mockReset();
	});

	it("renders the learner summary and a clean-timeline message when there are no flags", async () => {
		getAttemptReportMock.mockResolvedValue(report());
		renderWithProviders(
			<AttemptReportDialog attemptId="att1" onClose={vi.fn()} />,
		);

		expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("92")).toBeInTheDocument();
		expect(
			screen.getByText("No integrity flags recorded."),
		).toBeInTheDocument();
	});

	it("renders the flag timeline when events are present", async () => {
		getAttemptReportMock.mockResolvedValue(
			report({
				flagCount: 1,
				events: [
					{
						id: "e1",
						eventType: "tab_switch",
						severity: "medium",
						occurredAt: "2026-06-01T10:05:00.000Z",
						metadata: null,
						screenshotUrl: null,
					},
				],
			}),
		);
		renderWithProviders(
			<AttemptReportDialog attemptId="att1" onClose={vi.fn()} />,
		);
		expect(await screen.findByText("Tab switch")).toBeInTheDocument();
	});

	it("accepts the attempt", async () => {
		const { toast } = await import("sonner");
		getAttemptReportMock.mockResolvedValue(report());
		acceptAttemptMock.mockResolvedValue({});
		const onChanged = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<AttemptReportDialog
				attemptId="att1"
				onClose={vi.fn()}
				onChanged={onChanged}
			/>,
		);
		await screen.findByText("Ada Lovelace");

		await user.click(screen.getByRole("button", { name: "Accept" }));

		await waitFor(() => {
			expect(acceptAttemptMock).toHaveBeenCalledWith("att1");
		});
		expect(toast.success).toHaveBeenCalledWith("Attempt accepted");
		expect(onChanged).toHaveBeenCalled();
	});

	it("invalidates the attempt with a reason", async () => {
		const { toast } = await import("sonner");
		getAttemptReportMock.mockResolvedValue(report());
		invalidateAttemptMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderWithProviders(
			<AttemptReportDialog attemptId="att1" onClose={vi.fn()} />,
		);
		await screen.findByText("Ada Lovelace");

		await user.click(screen.getByRole("button", { name: "Invalidate" }));
		await user.type(
			screen.getByPlaceholderText("Optional reason…"),
			"Suspicious tab switching",
		);
		await user.click(
			screen.getByRole("button", { name: "Invalidate attempt" }),
		);

		await waitFor(() => {
			expect(invalidateAttemptMock).toHaveBeenCalledWith(
				"att1",
				"Suspicious tab switching",
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Attempt invalidated");
	});

	it("shows the invalidated banner when the attempt was already invalidated", async () => {
		getAttemptReportMock.mockResolvedValue(
			report({ invalidated: true, invalidatedReason: "Camera flags" }),
		);
		renderWithProviders(
			<AttemptReportDialog attemptId="att1" onClose={vi.fn()} />,
		);
		expect(
			await screen.findByText("Invalidated — learner must retake"),
		).toBeInTheDocument();
		expect(screen.getByText("Camera flags")).toBeInTheDocument();
	});

	it("closes on Escape", async () => {
		getAttemptReportMock.mockResolvedValue(report());
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<AttemptReportDialog attemptId="att1" onClose={onClose} />,
		);
		await screen.findByText("Ada Lovelace");

		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalled();
	});
});
