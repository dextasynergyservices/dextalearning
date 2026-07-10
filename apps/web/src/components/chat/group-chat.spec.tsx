// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/chat-api";
import { renderWithProviders } from "@/test/render";
import { GroupChat } from "./group-chat";

const { useSessionMock, getGroupInfoMock, useGroupChatMock, sendMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getGroupInfoMock: vi.fn(),
		useGroupChatMock: vi.fn(),
		sendMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/chat-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/chat-api")>();
	return { ...actual, getGroupInfo: getGroupInfoMock };
});

vi.mock("@/lib/use-group-chat", () => ({ useGroupChat: useGroupChatMock }));

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: "m1",
		groupId: "g1",
		userId: "u2",
		authorName: "Wei Chen",
		content: "hello team",
		createdAt: "2026-07-10T09:00:00Z",
		...overrides,
	};
}

describe("GroupChat", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getGroupInfoMock.mockReset();
		useGroupChatMock.mockReset();
		sendMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada", role: "learner" } },
		});
		getGroupInfoMock.mockResolvedValue({
			id: "g1",
			name: "Alpha",
			cohortTitle: "Cohort One",
			members: [
				{ userId: "u1", name: "Ada", role: "member" },
				{ userId: "u2", name: "Wei Chen", role: "lead" },
			],
		});
		useGroupChatMock.mockReturnValue({
			messages: [
				message(),
				message({ id: "m2", userId: "u1", authorName: "Ada", content: "hi!" }),
			],
			connected: true,
			send: sendMock,
			loadingHistory: false,
		});
	});

	it("renders the thread with author names for others' messages", async () => {
		renderWithProviders(<GroupChat groupId="g1" />);
		expect(await screen.findByText("Alpha")).toBeInTheDocument();
		expect(screen.getByText("hello team")).toBeInTheDocument();
		expect(screen.getByText("hi!")).toBeInTheDocument();
		// The other participant's name is labelled on their bubble.
		expect(screen.getByText("Wei Chen")).toBeInTheDocument();
	});

	it("sends a message and clears the input", async () => {
		const user = userEvent.setup();
		renderWithProviders(<GroupChat groupId="g1" />);
		const input = await screen.findByLabelText("Message your group…");

		await user.type(input, "great work everyone");
		await user.click(screen.getByRole("button", { name: "Send" }));

		expect(sendMock).toHaveBeenCalledWith("great work everyone");
		await waitFor(() => expect(input).toHaveValue(""));
	});

	it("shows an empty state when there are no messages", async () => {
		useGroupChatMock.mockReturnValue({
			messages: [],
			connected: true,
			send: sendMock,
			loadingHistory: false,
		});
		renderWithProviders(<GroupChat groupId="g1" />);
		expect(
			await screen.findByText(/say hi to your group/i),
		).toBeInTheDocument();
	});
});
