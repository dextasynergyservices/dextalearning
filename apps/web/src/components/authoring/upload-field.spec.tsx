// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { UploadField } from "./upload-field";

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function file(name = "lesson.mp4") {
	return new File(["fake bytes"], name, { type: "video/mp4" });
}

describe("UploadField", () => {
	it("renders the label and hint", () => {
		renderWithProviders(
			<UploadField
				label="Video"
				hint="MP4 up to 700MB"
				accept="video/*"
				onUpload={vi.fn()}
			/>,
		);
		expect(screen.getByText("Video")).toBeInTheDocument();
		expect(screen.getByText("MP4 up to 700MB")).toBeInTheDocument();
	});

	it("shows the ready/processing status badge", () => {
		const { rerender } = renderWithProviders(
			<UploadField
				label="Video"
				accept="video/*"
				onUpload={vi.fn()}
				status="ready"
			/>,
		);
		expect(screen.getByText("Ready")).toBeInTheDocument();

		rerender(
			<UploadField
				label="Video"
				accept="video/*"
				onUpload={vi.fn()}
				status="processing"
			/>,
		);
		expect(
			screen.getByText("Processing — encoding in the background"),
		).toBeInTheDocument();
	});

	it("calls onUpload with the selected file and shows a success toast", async () => {
		const { toast } = await import("sonner");
		const onUpload = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();
		const { container } = renderWithProviders(
			<UploadField label="Video" accept="video/*" onUpload={onUpload} />,
		);

		const input = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		await user.upload(input, file());

		expect(onUpload).toHaveBeenCalledWith(
			expect.objectContaining({ name: "lesson.mp4" }),
			expect.any(Function),
		);
		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith("Upload complete");
		});
	});

	it("shows a translated error toast when the upload fails", async () => {
		const { toast } = await import("sonner");
		const onUpload = vi
			.fn()
			.mockRejectedValue(new Error("errors.media.duration_exceeded"));
		const user = userEvent.setup();
		const { container } = renderWithProviders(
			<UploadField label="Video" accept="video/*" onUpload={onUpload} />,
		);

		const input = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		await user.upload(input, file());

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
	});
});
