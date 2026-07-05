// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LessonContextItem } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { LessonListPanel } from "./lesson-list-panel";

const LESSONS: LessonContextItem[] = [
	{
		id: "l1",
		title: "Welcome",
		contentType: "video",
		moduleTitle: "Module 1",
		done: true,
	},
	{
		id: "l2",
		title: "Setup",
		contentType: "text",
		moduleTitle: "Module 1",
		done: false,
	},
	{
		id: "l3",
		title: "Wrap-up",
		contentType: "video",
		moduleTitle: "Module 2",
		done: false,
	},
];

describe("LessonListPanel", () => {
	it("groups lessons by module, preserving order", () => {
		renderWithProviders(
			<LessonListPanel
				lessons={LESSONS}
				currentId="l1"
				doneCount={1}
				onSelect={vi.fn()}
			/>,
		);
		expect(screen.getByText("Module 1")).toBeInTheDocument();
		expect(screen.getByText("Module 2")).toBeInTheDocument();
		expect(screen.getByText("Welcome")).toBeInTheDocument();
		expect(screen.getByText("Wrap-up")).toBeInTheDocument();
	});

	it("shows the done-count summary", () => {
		renderWithProviders(
			<LessonListPanel
				lessons={LESSONS}
				currentId="l1"
				doneCount={1}
				onSelect={vi.fn()}
			/>,
		);
		expect(screen.getByText("1 of 3 complete")).toBeInTheDocument();
	});

	it("marks the current lesson as active via aria-current", () => {
		renderWithProviders(
			<LessonListPanel
				lessons={LESSONS}
				currentId="l2"
				doneCount={1}
				onSelect={vi.fn()}
			/>,
		);
		expect(screen.getByText("Setup").closest("button")).toHaveAttribute(
			"aria-current",
			"true",
		);
		expect(screen.getByText("Welcome").closest("button")).not.toHaveAttribute(
			"aria-current",
		);
	});

	it("calls onSelect with the lesson id when clicked", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<LessonListPanel
				lessons={LESSONS}
				currentId="l1"
				doneCount={1}
				onSelect={onSelect}
			/>,
		);
		await user.click(screen.getByText("Wrap-up"));
		expect(onSelect).toHaveBeenCalledWith("l3");
	});
});
