// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "./otp-input";

function Harness({ onComplete }: { onComplete?: (v: string) => void }) {
	const [value, setValue] = useState("");
	return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

describe("OtpInput", () => {
	it("auto-advances while typing and fires onComplete at 6 digits", async () => {
		const onComplete = vi.fn();
		const user = userEvent.setup();
		render(<Harness onComplete={onComplete} />);

		const cells = screen.getAllByLabelText(/Digit \d of 6/);
		await user.type(cells[0], "482913");

		expect(onComplete).toHaveBeenCalledWith("482913");
		expect((cells[5] as HTMLInputElement).value).toBe("3");
	});

	it("distributes a pasted code across the cells", async () => {
		const onComplete = vi.fn();
		const user = userEvent.setup();
		render(<Harness onComplete={onComplete} />);

		const cells = screen.getAllByLabelText(/Digit \d of 6/);
		cells[0].focus();
		await user.paste("112233");

		expect((cells[0] as HTMLInputElement).value).toBe("1");
		expect((cells[3] as HTMLInputElement).value).toBe("2");
		expect(onComplete).toHaveBeenCalledWith("112233");
	});

	it("ignores non-numeric input", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const cells = screen.getAllByLabelText(/Digit \d of 6/);
		await user.type(cells[0], "a");
		expect((cells[0] as HTMLInputElement).value).toBe("");
	});

	it("backspaces to the previous cell when empty", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const cells = screen.getAllByLabelText(
			/Digit \d of 6/,
		) as HTMLInputElement[];
		await user.type(cells[0], "12");
		// Caret now sits in cell 3 (index 2), empty → Backspace clears cell 2's "2".
		await user.keyboard("{Backspace}");
		expect(cells[1].value).toBe("");
		expect(cells[0].value).toBe("1");
	});
});
