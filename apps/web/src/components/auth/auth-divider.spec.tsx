// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { AuthDivider } from "./auth-divider";

describe("AuthDivider", () => {
	it("renders the translated divider text", () => {
		renderWithProviders(<AuthDivider />);
		expect(screen.getByText("or")).toBeInTheDocument();
	});
});
