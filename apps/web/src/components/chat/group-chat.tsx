import { useQuery } from "@tanstack/react-query";
import { Loader2, Send, Users } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/auth-client";
import { chatKeys, getGroupInfo } from "@/lib/chat-api";
import { useGroupChat } from "@/lib/use-group-chat";
import { cn } from "@/lib/utils";

function initials(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

const TINTS = [
	"bg-brand-solid",
	"bg-indigo-600",
	"bg-emerald-600",
	"bg-amber-600",
	"bg-rose-500",
	"bg-teal-600",
];
function tintFor(id: string): string {
	let hash = 0;
	for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	return TINTS[hash % TINTS.length];
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Real-time group chat panel (§4.7). Seeds from history then streams live
 * messages over Socket.io. Own messages align right in brand colour; others
 * show an initials avatar + author name. Composer is sticky at the bottom for a
 * native-app feel; the thread auto-scrolls to the newest message.
 */
export function GroupChat({ groupId }: { groupId: string }) {
	const { t } = useTranslation("chat");
	const { data: session } = useSession();
	const myId = session?.user?.id;
	const { data: info } = useQuery({
		queryKey: chatKeys.info(groupId),
		queryFn: () => getGroupInfo(groupId),
	});
	const { messages, connected, send, loadingHistory } = useGroupChat(groupId);
	const [draft, setDraft] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll to the newest message whenever the count changes (the body reads a ref, not the dep).
	useEffect(() => {
		bottomRef.current?.scrollIntoView?.({ block: "end" });
	}, [messages.length]);

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!draft.trim()) return;
		send(draft);
		setDraft("");
	};

	return (
		<div className="flex h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
			{/* Header */}
			<header className="flex items-center gap-3 border-border border-b px-4 py-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
					<Users className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-display text-foreground">
						{info?.name ?? t("group", { defaultValue: "Group" })}
					</p>
					<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<span
							className={cn(
								"size-1.5 rounded-full",
								connected ? "bg-success" : "bg-muted-foreground/40",
							)}
						/>
						{connected
							? t("members", {
									count: info?.members.length ?? 0,
									defaultValue: "{{count}} members",
								})
							: t("connecting", { defaultValue: "Connecting…" })}
					</p>
				</div>
			</header>

			{/* Thread */}
			<div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
				{loadingHistory ? (
					<div className="flex justify-center py-10">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : messages.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("empty", {
							defaultValue: "No messages yet — say hi to your group 👋",
						})}
					</p>
				) : (
					messages.map((m) => {
						const mine = m.userId === myId;
						return (
							<div
								key={m.id}
								className={cn(
									"flex items-end gap-2",
									mine ? "flex-row-reverse" : "flex-row",
								)}
							>
								{!mine ? (
									<span
										className={cn(
											"flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-[0.6rem] text-white",
											tintFor(m.userId),
										)}
									>
										{initials(m.authorName)}
									</span>
								) : null}
								<div
									className={cn(
										"max-w-[78%] rounded-card px-3 py-2 text-sm",
										mine
											? "rounded-br-sm bg-brand-solid text-white"
											: "rounded-bl-sm border border-border bg-card text-foreground",
									)}
								>
									{!mine ? (
										<p className="mb-0.5 font-medium text-brand-primary text-xs">
											{m.authorName}
										</p>
									) : null}
									<p className="whitespace-pre-wrap break-words">{m.content}</p>
									<p
										className={cn(
											"mt-0.5 text-right text-[0.6rem]",
											mine ? "text-white/70" : "text-muted-foreground",
										)}
									>
										{formatTime(m.createdAt)}
									</p>
								</div>
							</div>
						);
					})
				)}
				<div ref={bottomRef} />
			</div>

			{/* Composer */}
			<form
				onSubmit={onSubmit}
				className="flex items-center gap-2 border-border border-t p-3"
			>
				<input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder={t("placeholder", {
						defaultValue: "Message your group…",
					})}
					maxLength={2000}
					aria-label={t("placeholder", { defaultValue: "Message your group…" })}
					className="h-11 flex-1 rounded-pill border border-border bg-card px-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
				/>
				<button
					type="submit"
					disabled={!draft.trim()}
					aria-label={t("send", { defaultValue: "Send" })}
					className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-solid text-white transition-colors hover:bg-brand-solid-hover disabled:opacity-40"
				>
					<Send className="size-4" />
				</button>
			</form>
		</div>
	);
}
