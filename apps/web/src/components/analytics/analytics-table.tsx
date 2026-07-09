import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Responsive analytics table (blueprint pins TanStack Table v8). ONE table
 * instance drives both layouts, so sorting + pagination stay in sync:
 * - **Mobile** (`< lg`): a stacked card list (native-app feel — no horizontal
 *   scrolling of a wide table) with a compact sort dropdown.
 * - **Desktop** (`≥ lg`): the full sortable table.
 * Rows are tappable when `onRowClick` is set. Paginated below both.
 */
export function AnalyticsTable<T>({
	data,
	columns,
	initialSort,
	sortOptions,
	renderCard,
	onRowClick,
	pageSize = 8,
	emptyLabel,
	testId,
}: {
	data: T[];
	columns: ColumnDef<T>[];
	initialSort: SortingState;
	/** {id,label} for the mobile sort dropdown — ids must match column ids. */
	sortOptions: { id: string; label: string }[];
	renderCard: (row: T, open?: () => void) => ReactNode;
	onRowClick?: (row: T) => void;
	pageSize?: number;
	emptyLabel: string;
	testId?: string;
}) {
	const { t } = useTranslation("authoring");
	const [sorting, setSorting] = useState<SortingState>(initialSort);

	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize } },
	});

	if (data.length === 0) {
		return (
			<p className="px-4 py-10 text-center text-muted-foreground text-sm">
				{emptyLabel}
			</p>
		);
	}

	const rows = table.getRowModel().rows;
	const activeSort = sorting[0];

	return (
		<div data-testid={testId}>
			{/* Mobile: sort control + card list */}
			<div className="lg:hidden">
				<div className="flex items-center gap-2 px-4 py-3">
					<span className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						{t("analytics.sort_by")}
					</span>
					<select
						aria-label={t("analytics.sort_by")}
						value={activeSort?.id ?? ""}
						onChange={(e) => setSorting([{ id: e.target.value, desc: true }])}
						className="rounded-btn border border-border bg-card px-2.5 py-1.5 text-foreground text-sm outline-none focus:border-brand-primary"
					>
						{sortOptions.map((opt) => (
							<option key={opt.id} value={opt.id}>
								{opt.label}
							</option>
						))}
					</select>
				</div>
				<ul className="space-y-2 px-3 pb-2">
					{rows.map((row) => (
						<li key={row.id}>
							{renderCard(
								row.original,
								onRowClick ? () => onRowClick(row.original) : undefined,
							)}
						</li>
					))}
				</ul>
			</div>

			{/* Desktop: full table */}
			<div className="hidden overflow-x-auto lg:block">
				<table className="w-full border-collapse text-sm">
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} className="border-border border-b">
								{headerGroup.headers.map((header) => {
									const sorted = header.column.getIsSorted();
									const canSort = header.column.getCanSort();
									return (
										<th key={header.id} className="px-3 py-2.5 text-left">
											{canSort ? (
												<button
													type="button"
													onClick={header.column.getToggleSortingHandler()}
													className={cn(
														"inline-flex items-center gap-1 font-stats font-semibold text-xs uppercase tracking-wide transition-colors",
														sorted
															? "text-brand-primary"
															: "text-muted-foreground hover:text-foreground",
													)}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{sorted === "asc" ? (
														<ArrowUp className="size-3" />
													) : sorted === "desc" ? (
														<ArrowDown className="size-3" />
													) : (
														<ArrowUpDown className="size-3 opacity-50" />
													)}
												</button>
											) : (
												<span className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
												</span>
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.id}
								onClick={
									onRowClick ? () => onRowClick(row.original) : undefined
								}
								className={cn(
									"border-border/60 border-b last:border-b-0",
									onRowClick && "cursor-pointer hover:bg-accent/50",
								)}
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-3 py-3 align-middle">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{table.getPageCount() > 1 ? (
				<Pagination
					page={table.getState().pagination.pageIndex + 1}
					pageCount={table.getPageCount()}
					canPrev={table.getCanPreviousPage()}
					canNext={table.getCanNextPage()}
					onPrev={() => table.previousPage()}
					onNext={() => table.nextPage()}
				/>
			) : null}
		</div>
	);
}

function Pagination({
	page,
	pageCount,
	canPrev,
	canNext,
	onPrev,
	onNext,
}: {
	page: number;
	pageCount: number;
	canPrev: boolean;
	canNext: boolean;
	onPrev: () => void;
	onNext: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<div className="flex items-center justify-between gap-3 border-border border-t px-4 py-3">
			<p className="text-muted-foreground text-xs">
				{t("analytics.page_of", { page, total: pageCount })}
			</p>
			<div className="flex items-center gap-2">
				<PageButton
					onClick={onPrev}
					disabled={!canPrev}
					label={t("analytics.prev_page")}
				>
					<ChevronLeft className="size-4" />
				</PageButton>
				<PageButton
					onClick={onNext}
					disabled={!canNext}
					label={t("analytics.next_page")}
				>
					<ChevronRight className="size-4" />
				</PageButton>
			</div>
		</div>
	);
}

function PageButton({
	onClick,
	disabled,
	label,
	children,
}: {
	onClick: () => void;
	disabled: boolean;
	label: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			className="flex size-9 items-center justify-center rounded-btn border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
		>
			{children}
		</button>
	);
}
