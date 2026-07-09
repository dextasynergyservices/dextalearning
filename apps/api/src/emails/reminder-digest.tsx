import { Text } from "@react-email/components";
import { CtaButton, EmailLayout } from "./components/email-layout";
import { text } from "./theme";

/**
 * Daily learning digest (Phase 4, §3.1 spaced repetition + §3.2 streak loss
 * aversion). All copy arrives pre-localized from `reminder.messages.ts` —
 * this template only lays it out.
 */
export function ReminderDigestEmail({
	heading,
	recallLine,
	streakLine,
	reviewsIntro,
	reviewTitles,
	cta,
	ctaUrl = "https://dextalearning.com/dashboard",
}: {
	heading: string;
	/** §3.1 testing effect — the free-recall challenge leads the digest. */
	recallLine?: string;
	streakLine?: string;
	reviewsIntro?: string;
	reviewTitles: string[];
	cta: string;
	ctaUrl?: string;
}) {
	return (
		<EmailLayout preview={heading} heading={heading}>
			{recallLine ? <Text style={text.lead}>🧠 {recallLine}</Text> : null}
			{streakLine ? <Text style={text.lead}>🔥 {streakLine}</Text> : null}
			{reviewsIntro && reviewTitles.length > 0 ? (
				<>
					<Text style={text.lead}>{reviewsIntro}</Text>
					{reviewTitles.map((title) => (
						<Text key={title} style={text.fine}>
							📚 {title}
						</Text>
					))}
				</>
			) : null}
			<CtaButton href={ctaUrl}>{cta}</CtaButton>
		</EmailLayout>
	);
}

ReminderDigestEmail.PreviewProps = {
	heading: "Hey Ada, your brain is ready for a refresh",
	streakLine:
		"Your 5-day streak is on the line — one lesson today keeps it alive.",
	reviewsIntro: "These 2 lessons are due for a quick revisit:",
	reviewTitles: ["What is spacing?", "Retrieval practice basics"],
	cta: "Review now",
};

export default ReminderDigestEmail;
