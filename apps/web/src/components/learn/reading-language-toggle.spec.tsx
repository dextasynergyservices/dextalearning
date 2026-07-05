// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ReadingLanguageToggle } from "./reading-language-toggle";

describe("ReadingLanguageToggle", () => {
	it("lists Original plus all four languages", () => {
		renderWithProviders(
			<ReadingLanguageToggle
				lang="original"
				setLang={vi.fn()}
				loading={false}
			/>,
		);
		expect(
			screen.getByRole("option", { name: "Original" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Français" }),
		).toBeInTheDocument();
	});

	it("calls setLang when a new language is chosen", async () => {
		const setLang = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<ReadingLanguageToggle
				lang="original"
				setLang={setLang}
				loading={false}
			/>,
		);
		await user.selectOptions(screen.getByRole("combobox"), "fr");
		expect(setLang).toHaveBeenCalledWith("fr");
	});

	it("shows a spinner while loading", () => {
		const { container } = renderWithProviders(
			<ReadingLanguageToggle lang="fr" setLang={vi.fn()} loading={true} />,
		);
		expect(container.querySelector(".animate-spin")).toBeInTheDocument();
	});
});
