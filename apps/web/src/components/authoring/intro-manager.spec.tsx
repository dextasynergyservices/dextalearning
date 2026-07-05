// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntroLesson } from "@/lib/content-api";
import { renderWithRouter } from "@/test/render";
import { IntroManager } from "./intro-manager";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

describe("IntroManager", () => {
	beforeEach(() => {
		navigateMock.mockReset();
	});

	it("shows an 'Add intro / preview' button when there's no intro", async () => {
		renderWithRouter(
			<IntroManager
				id="p1"
				intro={null}
				editorArea="instructor"
				queryKey={["path", "p1"]}
				createFn={vi.fn()}
				removeFn={vi.fn()}
			/>,
		);
		expect(
			await screen.findByRole("button", { name: /Add intro \/ preview/ }),
		).toBeInTheDocument();
	});

	it("creates an intro lesson and navigates to its editor", async () => {
		const createFn = vi.fn().mockResolvedValue({ id: "lesson1" });
		const user = userEvent.setup();
		renderWithRouter(
			<IntroManager
				id="p1"
				intro={null}
				editorArea="instructor"
				queryKey={["path", "p1"]}
				createFn={createFn}
				removeFn={vi.fn()}
			/>,
		);

		await user.click(
			await screen.findByRole("button", { name: /Add intro \/ preview/ }),
		);

		await waitFor(() => {
			expect(createFn).toHaveBeenCalledWith("p1");
		});
		expect(navigateMock).toHaveBeenCalledWith({
			to: "/instructor/lessons/$lessonId",
			params: { lessonId: "lesson1" },
		});
	});

	it("shows 'Ready to preview' when the intro has media", async () => {
		const intro: IntroLesson = {
			id: "lesson1",
			contentType: "video",
			videoKeysJson: { hd: "k1" },
		};
		renderWithRouter(
			<IntroManager
				id="p1"
				intro={intro}
				editorArea="instructor"
				queryKey={["path", "p1"]}
				createFn={vi.fn()}
				removeFn={vi.fn()}
			/>,
		);
		expect(await screen.findByText("Ready to preview")).toBeInTheDocument();
		expect(screen.getByText("Video")).toBeInTheDocument();
	});

	it("shows 'Add media in the editor to finish' when the intro has no media yet", async () => {
		const intro: IntroLesson = { id: "lesson1", contentType: "video" };
		renderWithRouter(
			<IntroManager
				id="p1"
				intro={intro}
				editorArea="instructor"
				queryKey={["path", "p1"]}
				createFn={vi.fn()}
				removeFn={vi.fn()}
			/>,
		);
		expect(
			await screen.findByText("Add media in the editor to finish"),
		).toBeInTheDocument();
	});

	it("removes the intro and shows a success toast", async () => {
		const { toast } = await import("sonner");
		const removeFn = vi.fn().mockResolvedValue({});
		const intro: IntroLesson = { id: "lesson1", contentType: "text" };
		const user = userEvent.setup();
		renderWithRouter(
			<IntroManager
				id="p1"
				intro={intro}
				editorArea="admin"
				queryKey={["path", "p1"]}
				createFn={vi.fn()}
				removeFn={removeFn}
			/>,
		);

		await user.click(
			await screen.findByRole("button", { name: "Remove intro" }),
		);

		await waitFor(() => {
			expect(removeFn).toHaveBeenCalledWith("p1");
		});
		expect(toast.success).toHaveBeenCalledWith("Intro removed");
	});
});
