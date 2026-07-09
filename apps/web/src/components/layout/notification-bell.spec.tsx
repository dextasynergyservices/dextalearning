// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { NotificationBell } from "./notification-bell";

const { listNotificationsMock, markAllNotificationsReadMock } = vi.hoisted(
	() => ({
		listNotificationsMock: vi.fn(),
		markAllNotificationsReadMock: vi.fn(),
	}),
);

vi.mock("@/lib/engagement-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/engagement-api")>();
	return {
		...actual,
		listNotifications: listNotificationsMock,
		markAllNotificationsRead: markAllNotificationsReadMock,
	};
});

function page(unreadCount: number) {
	return {
		notifications: [
			{
				id: "n1",
				type: "badge_awarded",
				data: { badgeKey: "first_lesson" },
				readAt: null,
				createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
			},
			{
				id: "n2",
				type: "reminder_digest",
				data: null,
				readAt: new Date().toISOString(),
				createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
			},
		],
		nextCursor: null,
		unreadCount,
	};
}

describe("NotificationBell", () => {
	beforeEach(() => {
		listNotificationsMock.mockReset();
		markAllNotificationsReadMock.mockReset();
		markAllNotificationsReadMock.mockResolvedValue({ ok: true });
	});

	it("shows the unread-count dot", async () => {
		listNotificationsMock.mockResolvedValue(page(2));
		renderWithRouter(<NotificationBell />);
		expect(await screen.findByTestId("notification-dot")).toHaveTextContent(
			"2",
		);
	});

	it("hides the dot when everything is read", async () => {
		listNotificationsMock.mockResolvedValue(page(0));
		renderWithRouter(<NotificationBell />);
		await screen.findByRole("button", { name: "Notifications" });
		await waitFor(() => expect(listNotificationsMock).toHaveBeenCalled());
		expect(screen.queryByTestId("notification-dot")).not.toBeInTheDocument();
	});

	it("opens the panel with localized items and marks all read", async () => {
		listNotificationsMock.mockResolvedValue(page(1));
		const user = userEvent.setup();
		renderWithRouter(<NotificationBell />);

		await user.click(
			await screen.findByRole("button", { name: "Notifications" }),
		);
		// Desktop dropdown + mobile sheet both render the items.
		expect(
			(await screen.findAllByText("You earned a new award")).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText("First Steps is now in your collection.").length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText("Time for a quick review").length,
		).toBeGreaterThan(0);
		// Read-on-open.
		await waitFor(() =>
			expect(markAllNotificationsReadMock).toHaveBeenCalled(),
		);
	});

	it("shows the empty state without a mark-all action", async () => {
		listNotificationsMock.mockResolvedValue({
			notifications: [],
			nextCursor: null,
			unreadCount: 0,
		});
		const user = userEvent.setup();
		renderWithRouter(<NotificationBell />);

		await user.click(
			await screen.findByRole("button", { name: "Notifications" }),
		);
		expect(
			(await screen.findAllByText("You're all caught up!")).length,
		).toBeGreaterThan(0);
		expect(markAllNotificationsReadMock).not.toHaveBeenCalled();
	});
});
