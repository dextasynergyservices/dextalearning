import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { type ChatMessage, chatKeys, getGroupMessages } from "./chat-api";

// The socket shares the API's origin (strip the REST path prefix). Cookies ride
// along so the gateway authenticates the same Better Auth session as REST.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export interface GroupChat {
	messages: ChatMessage[];
	connected: boolean;
	send: (content: string) => void;
	loadingHistory: boolean;
}

/**
 * Live group chat: seeds from REST history, then opens a Socket.io connection,
 * joins the group room, and appends broadcast messages (de-duped by id).
 * Sending emits over the socket — the server persists and echoes it back, so
 * the sender sees their own message through the same broadcast path.
 */
export function useGroupChat(groupId: string): GroupChat {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const socketRef = useRef<Socket | null>(null);

	const { data: history, isPending: loadingHistory } = useQuery({
		queryKey: chatKeys.messages(groupId),
		queryFn: () => getGroupMessages(groupId),
	});

	useEffect(() => {
		if (history) setMessages(history.messages);
	}, [history]);

	useEffect(() => {
		const socket = io(SOCKET_URL, {
			withCredentials: true,
			transports: ["websocket", "polling"],
		});
		socketRef.current = socket;

		socket.on("connect", () => {
			setConnected(true);
			socket.emit("group:join", { groupId });
		});
		socket.on("disconnect", () => setConnected(false));
		socket.on("group:message", (message: ChatMessage) => {
			setMessages((prev) =>
				prev.some((m) => m.id === message.id) ? prev : [...prev, message],
			);
		});

		return () => {
			socket.emit("group:leave", { groupId });
			socket.disconnect();
			socketRef.current = null;
		};
	}, [groupId]);

	const send = useCallback(
		(content: string) => {
			const trimmed = content.trim();
			if (trimmed)
				socketRef.current?.emit("group:message", { groupId, content: trimmed });
		},
		[groupId],
	);

	return { messages, connected, send, loadingHistory };
}
