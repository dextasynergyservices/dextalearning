import { apiFetch } from "./api";

// Content Simplifier (§4.10 — "Simplify this"). Its own thin client. The server
// picks the lesson's text source (reading content, else transcript); we just
// ask for a plainer-language version. Session-based, like lesson playback.

export interface SimplifiedContent {
	simplified: string;
}

export const simplifyLesson = (lessonId: string) =>
	apiFetch<SimplifiedContent>(`/lessons/${lessonId}/simplify`, {
		method: "POST",
	});
