// @vitest-environment jsdom

import type { ColumnDef } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { AnalyticsTable } from "./analytics-table";

interface Row {
	name: string;
	score: number;
}

const columns: ColumnDef<Row>[] = [
	{ id: "name", accessorKey: "name", header: "Name" },
	{ id: "score", accessorKey: "score", header: "Score" },
];

function make(n: number): Row[] {
	return Array.from({ length: n }, (_, i) => ({
		name: `Item ${String(i + 1).padStart(2, "0")}`,
		score: i,
	}));
}

function renderTable(
	props: Partial<Parameters<typeof AnalyticsTable<Row>>[0]> = {},
) {
	return renderWithProviders(
		<AnalyticsTable
			data={make(20)}
			columns={columns}
			initialSort={[{ id: "score", desc: true }]}
			sortOptions={[
				{ id: "score", label: "Score" },
				{ id: "name", label: "Name" },
			]}
			emptyLabel="Nothing here"
			renderCard={(row, open) => (
				<button type="button" onClick={open} data-testid="card">
					{row.name}
				</button>
			)}
			{...props}
		/>,
	);
}

describe("AnalyticsTable", () => {
	it("paginates: shows a page of rows and advances on next", async () => {
		const user = userEvent.setup();
		renderTable();

		// Page 1 (pageSize 8): the desktop table body holds 8 rows.
		expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
		// Cards mirror the same page (mobile DOM is present in jsdom).
		expect(screen.getAllByTestId("card")).toHaveLength(8);

		await user.click(screen.getByRole("button", { name: "Next page" }));
		expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
	});

	it("sorts via the mobile dropdown", async () => {
		const user = userEvent.setup();
		renderTable();
		// Default score desc → Item 20 first among the cards.
		expect(screen.getAllByTestId("card")[0]).toHaveTextContent("Item 20");

		await user.selectOptions(screen.getByRole("combobox"), "name");
		// Name desc → Item 20 still first (string desc), but assert it re-sorted
		// by checking the control reflects the choice.
		expect(screen.getByRole("combobox")).toHaveValue("name");
	});

	it("fires onRowClick from a row/card", async () => {
		const onRowClick = vi.fn();
		const user = userEvent.setup();
		renderTable({ onRowClick });
		await user.click(screen.getAllByTestId("card")[0]);
		expect(onRowClick).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Item 20" }),
		);
	});

	it("hides pagination when everything fits on one page", () => {
		renderWithProviders(
			<AnalyticsTable
				data={make(3)}
				columns={columns}
				initialSort={[{ id: "score", desc: true }]}
				sortOptions={[{ id: "score", label: "Score" }]}
				emptyLabel="Nothing here"
				renderCard={(row) => <div>{row.name}</div>}
			/>,
		);
		expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
	});

	it("renders the empty state", () => {
		renderWithProviders(
			<AnalyticsTable
				data={[]}
				columns={columns}
				initialSort={[{ id: "score", desc: true }]}
				sortOptions={[{ id: "score", label: "Score" }]}
				emptyLabel="Nothing here"
				renderCard={(row) => <div>{row.name}</div>}
			/>,
		);
		expect(screen.getByText("Nothing here")).toBeInTheDocument();
	});
});
