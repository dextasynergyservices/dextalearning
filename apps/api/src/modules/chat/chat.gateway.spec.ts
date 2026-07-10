import { describe, expect, it, vi } from "vitest";
import { ChatGateway } from "./chat.gateway";
import type { ChatService } from "./chat.service";

function makeGateway(overrides: Partial<ChatService> = {}) {
	const chat = {
		assertAccess: vi.fn().mockResolvedValue("cohort-1"),
		saveMessage: vi.fn().mockResolvedValue({
			id: "m1",
			groupId: "g1",
			userId: "u1",
			authorName: "Ada",
			content: "hi",
			createdAt: new Date(),
		}),
		...overrides,
	} as unknown as ChatService;
	const gateway = new ChatGateway(chat);
	const emit = vi.fn();
	const to = vi.fn().mockReturnValue({ emit });
	// @ts-expect-error minimal server stub
	gateway.server = { to };
	return { gateway, chat, to, emit };
}

function client(user: { id: string; role: string } | null) {
	return {
		data: user ? { user } : {},
		join: vi.fn().mockResolvedValue(undefined),
		leave: vi.fn().mockResolvedValue(undefined),
	};
}

describe("ChatGateway", () => {
	it("joins the group room after an access check", async () => {
		const { gateway, chat } = makeGateway();
		const c = client({ id: "u1", role: "learner" });
		// biome-ignore lint/suspicious/noExplicitAny: minimal socket stub for the unit test.
		const res = await gateway.onJoin(c as any, { groupId: "g1" });
		expect(chat.assertAccess).toHaveBeenCalledWith(
			{ id: "u1", role: "learner" },
			"g1",
		);
		expect(c.join).toHaveBeenCalledWith("group:g1");
		expect(res).toEqual({ ok: true });
	});

	it("does not join when access is denied", async () => {
		const { gateway } = makeGateway({
			assertAccess: vi.fn().mockRejectedValue(new Error("forbidden")),
		});
		const c = client({ id: "u1", role: "learner" });
		// biome-ignore lint/suspicious/noExplicitAny: minimal socket stub.
		const res = await gateway.onJoin(c as any, { groupId: "g1" });
		expect(c.join).not.toHaveBeenCalled();
		expect(res).toMatchObject({ ok: false });
	});

	it("persists a message and broadcasts it to the group room", async () => {
		const { gateway, chat, to, emit } = makeGateway();
		const c = client({ id: "u1", role: "learner" });
		const res = await gateway.onMessage(
			// biome-ignore lint/suspicious/noExplicitAny: minimal socket stub.
			c as any,
			{ groupId: "g1", content: "  hi  " },
		);
		expect(chat.saveMessage).toHaveBeenCalledWith("u1", "g1", "hi");
		expect(to).toHaveBeenCalledWith("group:g1");
		expect(emit).toHaveBeenCalledWith("group:message", expect.any(Object));
		expect(res).toMatchObject({ ok: true });
	});

	it("rejects an empty or unauthenticated message without saving", async () => {
		const { gateway, chat, emit } = makeGateway();

		const authed = client({ id: "u1", role: "learner" });
		expect(
			// biome-ignore lint/suspicious/noExplicitAny: minimal socket stub.
			await gateway.onMessage(authed as any, { groupId: "g1", content: "   " }),
		).toMatchObject({ ok: false });

		const anon = client(null);
		expect(
			// biome-ignore lint/suspicious/noExplicitAny: minimal socket stub.
			await gateway.onMessage(anon as any, { groupId: "g1", content: "hi" }),
		).toMatchObject({ ok: false });

		expect(chat.saveMessage).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});
});
