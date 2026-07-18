// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { renderWithProviders } from "@/test/render";
import { LanguageSwitcher } from "./language-switcher";

// This component drives the app's REAL, shared i18n instance — reset it so a
// language change in one test doesn't leak translated copy into the next.
afterEach(async () => {
	await i18n.changeLanguage("en");
});

describe("LanguageSwitcher", () => {
	it("lists all four supported languages with full names by default", () => {
		renderWithProviders(<LanguageSwitcher />);
		expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Français" }),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Español" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Naijá" })).toBeInTheDocument();
	});

	it("uses short codes in compact mode", () => {
		renderWithProviders(<LanguageSwitcher compact />);
		expect(screen.getByRole("option", { name: "FR" })).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Français" }),
		).not.toBeInTheDocument();
	});

	it("changes the real i18n language when a new option is selected", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LanguageSwitcher />);

		await user.selectOptions(screen.getByRole("combobox"), "fr");
		// changeLanguage is async since locales became lazy chunks (§13.2) —
		// the switch completes when fr's namespaces land, not synchronously.
		await waitFor(() => expect(i18n.resolvedLanguage).toBe("fr"));
	});
});
