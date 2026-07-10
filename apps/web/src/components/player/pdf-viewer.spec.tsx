// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfViewer } from "./pdf-viewer";

function setScroll(
	el: HTMLElement,
	{ scrollTop, clientHeight, scrollHeight }: Record<string, number>,
) {
	for (const [prop, value] of Object.entries({
		scrollTop,
		clientHeight,
		scrollHeight,
	})) {
		Object.defineProperty(el, prop, { configurable: true, value });
	}
}

describe("PdfViewer read-progress", () => {
	it("does NOT complete on mount, nor on a small scroll (the reported bug)", () => {
		const onProgress = vi.fn();
		render(
			<PdfViewer
				pages={["/p1.webp", "/p2.webp", "/p3.webp"]}
				onProgress={onProgress}
			/>,
		);
		const scroller = screen.getByTestId("pdf-scroll");
		// Mount: nothing fired yet.
		expect(onProgress).not.toHaveBeenCalled();

		// Scrolled ~10% through a tall document — not enough.
		setScroll(scroller, {
			scrollTop: 0,
			clientHeight: 100,
			scrollHeight: 1000,
		});
		fireEvent.scroll(scroller);
		expect(onProgress).not.toHaveBeenCalled();
	});

	it("completes once the learner scrolls through ≥ 80%", () => {
		const onProgress = vi.fn();
		render(
			<PdfViewer pages={["/p1.webp", "/p2.webp"]} onProgress={onProgress} />,
		);
		const scroller = screen.getByTestId("pdf-scroll");

		// (scrollTop 700 + clientHeight 100) / scrollHeight 1000 = 0.80.
		setScroll(scroller, {
			scrollTop: 700,
			clientHeight: 100,
			scrollHeight: 1000,
		});
		fireEvent.scroll(scroller);
		expect(onProgress).toHaveBeenCalledWith(100);
	});

	it("treats a document that fits on screen as read — but only after its images load", () => {
		const onProgress = vi.fn();
		render(<PdfViewer pages={["/only.webp"]} onProgress={onProgress} />);
		const scroller = screen.getByTestId("pdf-scroll");
		// Fits entirely (no scroll room).
		setScroll(scroller, { scrollTop: 0, clientHeight: 500, scrollHeight: 500 });

		// A scroll before the image loads must NOT complete it.
		fireEvent.scroll(scroller);
		expect(onProgress).not.toHaveBeenCalled();

		// Once the single page image loads, it counts as fully read.
		fireEvent.load(screen.getByAltText("Page 1"));
		expect(onProgress).toHaveBeenCalledWith(100);
	});
});
