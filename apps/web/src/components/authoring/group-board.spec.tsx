// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupingBoard } from "@/lib/grouping-api";
import { renderWithProviders } from "@/test/render";
import { GroupBoard } from "./group-board";

const {
	getGroupingBoardMock,
	generateGroupsMock,
	assignLearnerMock,
	createGroupMock,
	setGroupLeadMock,
} = vi.hoisted(() => ({
	getGroupingBoardMock: vi.fn(),
	generateGroupsMock: vi.fn(),
	assignLearnerMock: vi.fn(),
	createGroupMock: vi.fn(),
	setGroupLeadMock: vi.fn(),
}));

vi.mock("@/lib/grouping-api", () => ({
	getGroupingBoard: getGroupingBoardMock,
	generateGroups: generateGroupsMock,
	assignLearner: assignLearnerMock,
	createGroup: createGroupMock,
	renameGroup: vi.fn(),
	deleteGroup: vi.fn(),
	setGroupLead: setGroupLeadMock,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function board(overrides: Partial<GroupingBoard> = {}): GroupingBoard {
	return {
		cohort: {
			id: "c1",
			title: "Cohort One",
			groupingMode: "manual",
			targetGroupSize: 3,
			minGroupSize: 2,
			maxGroupSize: 5,
		},
		groups: [
			{
				id: "g1",
				name: "Group 1",
				type: "manual",
				members: [
					{
						userId: "u1",
						name: "Uno One",
						skillLevel: "beginner",
						role: "member",
					},
				],
			},
			{ id: "g2", name: "Group 2", type: "manual", members: [] },
		],
		unassigned: [{ userId: "u2", name: "Dos Two", skillLevel: null }],
		...overrides,
	};
}

describe("GroupBoard", () => {
	beforeEach(() => {
		getGroupingBoardMock.mockReset();
		generateGroupsMock.mockReset();
		assignLearnerMock.mockReset();
		createGroupMock.mockReset();
		setGroupLeadMock.mockReset();
		getGroupingBoardMock.mockResolvedValue(board());
	});

	it("renders the groups, members and the unassigned pool", async () => {
		renderWithProviders(<GroupBoard cohortId="c1" />);
		expect(await screen.findByText("Group 1")).toBeInTheDocument();
		expect(screen.getByText("Group 2")).toBeInTheDocument();
		expect(screen.getByText("Uno One")).toBeInTheDocument();
		expect(screen.getByText("Dos Two")).toBeInTheDocument();
		expect(screen.getByText("Unassigned")).toBeInTheDocument();
	});

	it("generates groups immediately when none exist yet", async () => {
		getGroupingBoardMock.mockResolvedValue(board({ groups: [] }));
		generateGroupsMock.mockResolvedValue(board());
		const user = userEvent.setup();
		renderWithProviders(<GroupBoard cohortId="c1" />);

		await user.click(
			await screen.findByRole("button", { name: "Generate groups" }),
		);
		expect(generateGroupsMock).toHaveBeenCalledWith("c1");
	});

	it("confirms before re-grouping when groups already exist", async () => {
		generateGroupsMock.mockResolvedValue(board());
		const user = userEvent.setup();
		renderWithProviders(<GroupBoard cohortId="c1" />);

		await user.click(await screen.findByRole("button", { name: "Re-group" }));
		// A confirm dialog appears; nothing fired yet.
		const dialog = await screen.findByRole("dialog");
		expect(generateGroupsMock).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole("button", { name: "Re-group" }));
		expect(generateGroupsMock).toHaveBeenCalledWith("c1");
	});

	it("moves a grouped learner into another group via the Move sheet", async () => {
		assignLearnerMock.mockResolvedValue({ ok: true });
		const user = userEvent.setup();
		renderWithProviders(<GroupBoard cohortId="c1" />);
		await screen.findByText("Uno One");

		// u1's chip → "Move" opens the sheet → choose Group 2 (scoped to the
		// dialog, since the Group 2 column header is also a "Group 2" button).
		await user.click(screen.getByRole("button", { name: "Move" }));
		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: "Group 2" }));

		expect(assignLearnerMock).toHaveBeenCalledWith("c1", "u1", "g2");
	});

	it("promotes a member to lead from the Move sheet", async () => {
		setGroupLeadMock.mockResolvedValue({ ok: true });
		const user = userEvent.setup();
		renderWithProviders(<GroupBoard cohortId="c1" />);
		await screen.findByText("Uno One");

		await user.click(screen.getByRole("button", { name: "Move" }));
		await user.click(
			await screen.findByRole("button", { name: "Make group lead" }),
		);

		expect(setGroupLeadMock).toHaveBeenCalledWith("c1", "g1", "u1");
	});

	it("forms a new group from picked unassigned learners", async () => {
		createGroupMock.mockResolvedValue({ id: "g3", name: "Group 3" });
		assignLearnerMock.mockResolvedValue({ ok: true });
		const user = userEvent.setup();
		renderWithProviders(<GroupBoard cohortId="c1" />);
		await screen.findByText("Dos Two");

		// Pick the unassigned learner, then form a group from the selection.
		await user.click(screen.getByText("Dos Two"));
		expect(await screen.findByText("1 selected")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "New group with 1" }));

		await waitFor(() => expect(createGroupMock).toHaveBeenCalledWith("c1"));
		await waitFor(() =>
			expect(assignLearnerMock).toHaveBeenCalledWith("c1", "u2", "g3"),
		);
	});

	it("creates a new empty group from the header", async () => {
		createGroupMock.mockResolvedValue({ id: "g3", name: "Group 3" });
		const user = userEvent.setup();
		renderWithProviders(<GroupBoard cohortId="c1" />);

		await user.click(await screen.findByRole("button", { name: "New group" }));
		await waitFor(() => expect(createGroupMock).toHaveBeenCalledWith("c1"));
	});
});
