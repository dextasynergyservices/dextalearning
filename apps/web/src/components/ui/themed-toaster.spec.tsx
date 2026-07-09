// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import { setTheme } from "@/lib/theme";
import { ThemedToaster } from "./themed-toaster";

describe("ThemedToaster", () => {
	afterEach(() => {
		toast.dismiss();
		setTheme("system");
	});

	it("renders fired toasts with the stored app theme (dark toasts on dark UI)", async () => {
		setTheme("dark");
		const { container } = render(<ThemedToaster />);

		toast.success("Saved in the dark");

		// Sonner mounts its DOM lazily on the first toast.
		expect(await screen.findByText("Saved in the dark")).toBeInTheDocument();
		expect(
			container
				.querySelector("[data-sonner-toaster]")
				?.getAttribute("data-sonner-theme"),
		).toBe("dark");
	});

	it("renders light toasts when the theme is light", async () => {
		setTheme("light");
		const { container } = render(<ThemedToaster />);

		toast.success("Saved in the light");

		expect(await screen.findByText("Saved in the light")).toBeInTheDocument();
		expect(
			container
				.querySelector("[data-sonner-toaster]")
				?.getAttribute("data-sonner-theme"),
		).toBe("light");
	});
});
