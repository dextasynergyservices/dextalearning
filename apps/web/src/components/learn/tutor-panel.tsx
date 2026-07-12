import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	AlertCircle,
	ChevronDown,
	Send,
	Sparkles,
	TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api";
import { askTutorStream, type TutorTurn } from "@/lib/tutor-api";
import { cn } from "@/lib/utils";

interface TutorMessage extends TutorTurn {
	/** Stable key for the rendered list. */
	id: string;
	/** Assistant turns only: false when the lesson didn't cover the question. */
	grounded?: boolean;
	/** Assistant turns only: the request failed. */
	error?: boolean;
}

let messageSeq = 0;
const nextId = () => `tm-${messageSeq++}`;

/**
 * AI Lesson Tutor (§4.10) — an inline, transcript-grounded chat the learner can
 * expand while studying. Only mounted when the lesson has a transcript, so it
 * always has something to ground answers in. Native-feeling on mobile (inline
 * accordion, no overlay) and desktop alike.
 */
export function TutorPanel({
	lessonId,
	lessonTitle,
}: {
	lessonId: string;
	lessonTitle: string;
}) {
	const { t } = useTranslation("ai");
	const reduceMotion = useReducedMotion();
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<TutorMessage[]>([]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll to the newest message as the thread grows (the body reads a ref, not the deps).
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages, pending]);

	const send = async (raw: string) => {
		const question = raw.trim();
		if (!question || pending) return;
		// Snapshot history BEFORE adding this turn — only real (non-error) turns.
		const history: TutorTurn[] = messages
			.filter((m) => !m.error)
			.map(({ role, content }) => ({ role, content }));
		const answerId = nextId();
		setMessages((prev) => [
			...prev,
			{ id: nextId(), role: "user", content: question },
			{ id: answerId, role: "assistant", content: "" },
		]);
		setInput("");
		setPending(true);
		try {
			// Stream the answer token-by-token into the placeholder bubble.
			await askTutorStream(lessonId, question, history, (delta) => {
				setMessages((prev) =>
					prev.map((m) =>
						m.id === answerId ? { ...m, content: m.content + delta } : m,
					),
				);
			});
		} catch (err) {
			const message =
				err instanceof ApiError && err.code === "AI_DAILY_LIMIT"
					? t("tutor.limit", {
							defaultValue:
								"You've reached today's AI limit. Try again tomorrow.",
						})
					: err instanceof ApiError
						? err.message
						: t("tutor.error", {
								defaultValue: "The tutor couldn't answer.",
							});
			setMessages((prev) =>
				prev.map((m) =>
					m.id === answerId ? { ...m, content: message, error: true } : m,
				),
			);
		} finally {
			setPending(false);
		}
	};

	const suggestions = [
		t("tutor.suggest_summary", { defaultValue: "Summarize this lesson" }),
		t("tutor.suggest_explain", {
			defaultValue: "Explain the key idea simply",
		}),
		t("tutor.suggest_example", { defaultValue: "Give me an example" }),
	];

	return (
		<div className="overflow-hidden rounded-card border border-brand-primary/20 bg-card shadow-card">
			<button
				type="button"
				onClick={() => {
					setOpen((o) => !o);
					if (!open) setTimeout(() => inputRef.current?.focus(), 250);
				}}
				aria-expanded={open}
				className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-brand-primary-light/40"
			>
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
					<Sparkles className="size-5" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block font-display text-foreground text-sm">
						{t("tutor.title", { defaultValue: "Ask the AI tutor" })}
					</span>
					<span className="block truncate text-muted-foreground text-xs">
						{t("tutor.subtitle", {
							defaultValue: "Answers grounded in this lesson",
						})}
					</span>
				</span>
				<ChevronDown
					className={cn(
						"size-5 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>

			<AnimatePresence initial={false}>
				{open ? (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={
							reduceMotion
								? { duration: 0 }
								: { type: "spring", stiffness: 380, damping: 38 }
						}
						className="border-border border-t"
					>
						<div
							ref={scrollRef}
							// Streamed answers are announced to screen readers as they arrive.
							aria-live="polite"
							aria-atomic="false"
							className="max-h-[22rem] min-h-[8rem] space-y-3 overflow-y-auto px-4 py-4"
						>
							{messages.length === 0 ? (
								<div className="space-y-3">
									<p className="text-muted-foreground text-sm">
										{t("tutor.empty", {
											defaultValue:
												"Stuck on “{{title}}”? Ask me anything about it.",
											title: lessonTitle,
										})}
									</p>
									<div className="flex flex-wrap gap-2">
										{suggestions.map((s) => (
											<button
												key={s}
												type="button"
												onClick={() => send(s)}
												className="rounded-pill border border-brand-primary/30 bg-brand-primary-light/40 px-3 py-1.5 text-brand-primary text-xs transition-colors hover:bg-brand-primary-light"
											>
												{s}
											</button>
										))}
									</div>
								</div>
							) : (
								messages.map((m) => <TutorBubble key={m.id} message={m} />)
							)}

							{pending ? (
								<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
									<TypingDots />
								</div>
							) : null}
						</div>

						<form
							onSubmit={(e) => {
								e.preventDefault();
								send(input);
							}}
							className="flex items-end gap-2 border-border border-t p-3"
						>
							<textarea
								ref={inputRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										send(input);
									}
								}}
								rows={1}
								placeholder={t("tutor.placeholder", {
									defaultValue: "Ask about this lesson…",
								})}
								aria-label={t("tutor.input_label", {
									defaultValue: "Your question",
								})}
								className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-btn border border-border bg-background px-3 py-2 text-foreground text-sm outline-none transition-colors focus:border-brand-primary"
							/>
							<button
								type="submit"
								disabled={!input.trim() || pending}
								aria-label={t("tutor.send", { defaultValue: "Send" })}
								className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary text-white transition-all hover:bg-brand-primary-hover active:scale-95 disabled:opacity-40"
							>
								<Send className="size-4" />
							</button>
						</form>

						<p className="flex items-center gap-1.5 bg-muted/40 px-4 py-2 text-muted-foreground text-xs">
							<TriangleAlert className="size-3.5 shrink-0" />
							{t("tutor.disclaimer", {
								defaultValue: "AI can make mistakes — verify what matters.",
							})}
						</p>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

function TutorBubble({ message }: { message: TutorMessage }) {
	const { t } = useTranslation("ai");
	const isUser = message.role === "user";

	if (message.error) {
		return (
			<div className="flex items-start gap-2 rounded-card border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
				<AlertCircle className="mt-0.5 size-4 shrink-0" />
				<span>{message.content}</span>
			</div>
		);
	}

	return (
		<div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
			<div
				data-testid={isUser ? undefined : "tutor-answer"}
				className={cn(
					"max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-sm",
					isUser ? "bg-brand-primary text-white" : "bg-muted text-foreground",
				)}
			>
				{message.content}
				{!isUser && message.grounded === false ? (
					<span className="mt-1.5 flex items-center gap-1 font-medium text-amber-600 text-xs dark:text-amber-400">
						<AlertCircle className="size-3" />
						{t("tutor.not_covered", {
							defaultValue: "Not covered in this lesson",
						})}
					</span>
				) : null}
			</div>
		</div>
	);
}

function TypingDots() {
	const reduceMotion = useReducedMotion();
	return (
		<span className="flex gap-1" aria-hidden>
			{["a", "b", "c"].map((k, i) => (
				<motion.span
					key={k}
					className="size-1.5 rounded-full bg-brand-primary/60"
					animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
					transition={
						reduceMotion
							? undefined
							: {
									duration: 1,
									repeat: Number.POSITIVE_INFINITY,
									delay: i * 0.15,
								}
					}
				/>
			))}
		</span>
	);
}
