// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OptionCard } from "./option-card";

describe("OptionCard", () => {
	it("renders the label and description", () => {
		render(
			<OptionCard
				label="Learner"
				description="Take courses"
				selected={false}
				onClick={vi.fn()}
			/>,
		);
		expect(screen.getByText("Learner")).toBeInTheDocument();
		expect(screen.getByText("Take courses")).toBeInTheDocument();
	});

	it("reflects selection via aria-pressed and shows the check icon", () => {
		const { rerender } = render(
			<OptionCard label="Learner" selected={false} onClick={vi.fn()} />,
		);
		expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

		rerender(<OptionCard label="Learner" selected={true} onClick={vi.fn()} />);
		expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
	});

	it("calls onClick when clicked", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		render(<OptionCard label="Learner" selected={false} onClick={onClick} />);

		await user.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
