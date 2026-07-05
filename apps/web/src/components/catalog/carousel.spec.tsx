// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Carousel } from "./carousel";

describe("Carousel", () => {
	it("renders each item via the render prop", () => {
		render(
			<Carousel
				items={["a", "b", "c"]}
				getKey={(item) => item}
				render={(item) => <span>Item {item}</span>}
			/>,
		);
		expect(screen.getByText("Item a")).toBeInTheDocument();
		expect(screen.getByText("Item b")).toBeInTheDocument();
		expect(screen.getByText("Item c")).toBeInTheDocument();
	});

	it("renders working prev/next controls", async () => {
		const user = userEvent.setup();
		render(
			<Carousel
				items={["a", "b"]}
				getKey={(item) => item}
				render={(item) => <span>{item}</span>}
			/>,
		);
		// scrollBy is stubbed in test/setup.ts — this just confirms clicking
		// doesn't throw.
		await user.click(screen.getByRole("button", { name: "Previous" }));
		await user.click(screen.getByRole("button", { name: "Next" }));
	});
});
