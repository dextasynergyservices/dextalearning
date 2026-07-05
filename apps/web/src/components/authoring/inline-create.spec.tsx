// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { InlineCreate } from "./inline-create";

const { createCourseMock, createPathMock } = vi.hoisted(() => ({
	createCourseMock: vi.fn(),
	createPathMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		createCourse: createCourseMock,
		createPath: createPathMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

describe("InlineCreate", () => {
	beforeEach(() => {
		createCourseMock.mockReset();
		createPathMock.mockReset();
	});

	it("disables the create button until a title is entered", async () => {
		const user = userEvent.setup();
		renderWithProviders(<InlineCreate kind="course" onCreated={vi.fn()} />);
		const button = screen.getByRole("button", { name: "Create & add" });
		expect(button).toBeDisabled();

		await user.type(
			screen.getByPlaceholderText("New course title…"),
			"React Basics",
		);
		expect(button).toBeEnabled();
	});

	it("creates a course, clears the title, and calls onCreated with the new id", async () => {
		createCourseMock.mockResolvedValue({ id: "c1", title: "React Basics" });
		const onCreated = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(<InlineCreate kind="course" onCreated={onCreated} />);

		const input = screen.getByPlaceholderText("New course title…");
		await user.type(input, "React Basics");
		await user.click(screen.getByRole("button", { name: "Create & add" }));

		await waitFor(() => {
			expect(onCreated).toHaveBeenCalledWith("c1");
		});
		expect(createCourseMock).toHaveBeenCalledWith({ title: "React Basics" });
		expect(input).toHaveValue("");
	});

	it("creates a path (not a course) when kind='path'", async () => {
		createPathMock.mockResolvedValue({ id: "p1", title: "Full Stack" });
		const user = userEvent.setup();
		renderWithProviders(<InlineCreate kind="path" onCreated={vi.fn()} />);

		await user.type(
			screen.getByPlaceholderText("New path title…"),
			"Full Stack{Enter}",
		);

		await waitFor(() => {
			expect(createPathMock).toHaveBeenCalledWith({ title: "Full Stack" });
		});
		expect(createCourseMock).not.toHaveBeenCalled();
	});

	it("shows an error toast when creation fails", async () => {
		const { toast } = await import("sonner");
		createCourseMock.mockRejectedValue(new Error("Something went wrong"));
		const user = userEvent.setup();
		renderWithProviders(<InlineCreate kind="course" onCreated={vi.fn()} />);

		await user.type(
			screen.getByPlaceholderText("New course title…"),
			"React Basics{Enter}",
		);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Something went wrong");
		});
	});
});
