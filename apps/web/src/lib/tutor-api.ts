import { API_URL, ApiError, apiFetch } from "./api";

// AI Lesson Tutor (§4.10) — Q&A grounded in the instructor's transcript. Its
// own thin client (bounded-context mirror; content-api.ts is huge). Access is
// session-based, matching lesson playback.

export interface TutorTurn {
	role: "user" | "assistant";
	content: string;
}

export interface TutorAnswer {
	answer: string;
	/** false when the lesson doesn't cover the question — UI flags it gently. */
	grounded: boolean;
}

export const askTutor = (
	lessonId: string,
	question: string,
	history: TutorTurn[] = [],
) =>
	apiFetch<TutorAnswer>(`/lessons/${lessonId}/tutor`, {
		method: "POST",
		body: JSON.stringify({ question, history }),
	});

/**
 * Streaming tutor: POSTs the question and invokes `onDelta` for each text chunk
 * as it arrives (live typing effect), resolving with the full answer. Throws
 * `ApiError` on a pre-stream failure (e.g. 422 no transcript, 429 rate limit).
 */
export async function askTutorStream(
	lessonId: string,
	question: string,
	history: TutorTurn[],
	onDelta: (text: string) => void,
): Promise<string> {
	const res = await fetch(`${API_URL}/lessons/${lessonId}/tutor/stream`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ question, history }),
	});
	if (!res.ok || !res.body) {
		const body = (await res.json().catch(() => null)) as {
			error?: { message?: string; code?: string };
		} | null;
		throw new ApiError(
			body?.error?.message ?? "The tutor couldn't answer.",
			body?.error?.code,
		);
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let full = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		const text = decoder.decode(value, { stream: true });
		if (text) {
			full += text;
			onDelta(text);
		}
	}
	return full;
}
