import { useCallback, useEffect, useRef } from "react";
import { saveAttemptAnswer } from "@/lib/content-api";

/**
 * Offline resilience for assessment-taking (§4.6.3-compatible). The rule:
 * a dropped connection must never close or fail an attempt — but it must not
 * pause the exam either, or airplane mode becomes the cheapest cheat in the
 * product. So the server clock keeps running; everything else becomes
 * unloseable:
 *
 *  - Every answer is mirrored to localStorage the moment it's chosen, so a
 *    crash/refresh mid-outage restores exactly what the learner had (the
 *    server's copy of a resumed attempt only knows the saves that got
 *    through).
 *  - Per-question saves that fail are queued (last write per question wins)
 *    and flushed when connectivity returns — the resume path heals itself.
 *  - The final submit already carries the FULL answers map, so nothing here
 *    is load-bearing for grading; it's load-bearing for resume and nerves.
 */

const storageKey = (attemptId: string) => `dexta-attempt-${attemptId}`;

export function loadLocalAnswers(attemptId: string): Record<string, string> {
	try {
		const raw = localStorage.getItem(storageKey(attemptId));
		return raw ? (JSON.parse(raw) as Record<string, string>) : {};
	} catch {
		return {};
	}
}

export function clearLocalAnswers(attemptId: string): void {
	try {
		localStorage.removeItem(storageKey(attemptId));
	} catch {
		// Storage unavailable — nothing to clear.
	}
}

export function useAttemptResilience(attemptId: string) {
	/** Answers whose server save failed; last write per question wins. */
	const pending = useRef(new Map<string, string>());
	const flushing = useRef(false);

	const flushPending = useCallback(async () => {
		if (flushing.current || pending.current.size === 0) return;
		flushing.current = true;
		try {
			for (const [questionId, answer] of [...pending.current]) {
				await saveAttemptAnswer(attemptId, questionId, answer);
				// Only delete if unchanged meanwhile — a newer answer must survive
				// to be flushed on the next pass.
				if (pending.current.get(questionId) === answer) {
					pending.current.delete(questionId);
				}
			}
		} catch {
			// Still offline — the remaining entries stay queued for next time.
		} finally {
			flushing.current = false;
		}
	}, [attemptId]);

	/** Mirror locally, then save — queueing the save if the network is away. */
	const persistAnswer = useCallback(
		(answers: Record<string, string>, questionId: string, answer: string) => {
			try {
				localStorage.setItem(storageKey(attemptId), JSON.stringify(answers));
			} catch {
				// Storage full/blocked: in-memory state still holds the answer.
			}
			saveAttemptAnswer(attemptId, questionId, answer).catch(() => {
				pending.current.set(questionId, answer);
			});
		},
		[attemptId],
	);

	// Heal when connectivity returns, and sweep periodically in case `online`
	// fires optimistically (captive portals) before requests actually succeed.
	useEffect(() => {
		const onOnline = () => void flushPending();
		window.addEventListener("online", onOnline);
		const sweep = setInterval(() => void flushPending(), 15_000);
		return () => {
			window.removeEventListener("online", onOnline);
			clearInterval(sweep);
		};
	}, [flushPending]);

	return { persistAnswer, flushPending };
}
