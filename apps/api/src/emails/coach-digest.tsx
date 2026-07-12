import { Hr, Text } from "@react-email/components";
import { CtaButton, EmailLayout } from "./components/email-layout";
import { text } from "./theme";

/**
 * Weekly Learning Coach digest (§4.10; §3.1 growth mindset). The headline,
 * message and action are AI-composed and already localized; only the layout,
 * subject/label chrome and CTA come from `coach.messages.ts`.
 */
export function CoachDigestEmail({
	headline,
	message,
	action,
	actionLabel,
	cta,
	ctaUrl = "https://dextalearning.com/dashboard",
}: {
	headline: string;
	message: string;
	action?: string;
	actionLabel: string;
	cta: string;
	ctaUrl?: string;
}) {
	return (
		<EmailLayout preview={headline} heading={headline}>
			<Text style={text.lead}>{message}</Text>
			{action ? (
				<>
					<Hr />
					<Text style={text.fine}>🎯 {actionLabel}</Text>
					<Text style={text.lead}>{action}</Text>
				</>
			) : null}
			<CtaButton href={ctaUrl}>{cta}</CtaButton>
		</EmailLayout>
	);
}

CoachDigestEmail.PreviewProps = {
	headline: "You're building real momentum, Ada!",
	message:
		"You finished 4 lessons and passed 2 quizzes this week — your effort is clearly paying off.",
	action:
		"Explain the idea of spaced repetition in your own words, then start your next lesson.",
	actionLabel: "This week's focus",
	cta: "Keep learning",
};

export default CoachDigestEmail;
