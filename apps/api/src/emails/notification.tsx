import { Text } from "@react-email/components";
import { CtaButton, EmailLayout } from "./components/email-layout";
import { text } from "./theme";

/**
 * The shared template for §8.6 notification emails — certificates, payouts,
 * Earn-Back, grading, integrity, grouping.
 *
 * These are all the same shape (a headline, a line or two of plain English, and
 * one thing to go do), so they get one template rather than a dozen
 * near-identical files. It exists because those emails used to ship as bare
 * `<p>` strings: no wordmark, no card, no footer, no dark-mode — nothing the
 * branded auth/digest mails have. Every email goes through React Email.
 *
 * Copy is passed in already composed and localized; this file owns only layout.
 */
export function NotificationEmail({
	preview,
	heading,
	paragraphs,
	cta,
	ctaUrl,
}: {
	/** Inbox preview line — the first thing read, before the mail is opened. */
	preview: string;
	heading: string;
	/** One paragraph per entry, in reading order. */
	paragraphs: string[];
	cta?: string;
	ctaUrl?: string;
}) {
	return (
		<EmailLayout preview={preview} heading={heading}>
			{paragraphs.map((paragraph) => (
				<Text key={paragraph} style={text.lead}>
					{paragraph}
				</Text>
			))}
			{cta && ctaUrl ? <CtaButton href={ctaUrl}>{cta}</CtaButton> : null}
		</EmailLayout>
	);
}

NotificationEmail.PreviewProps = {
	preview: "₦7,125 is on its way back to your card",
	heading: "Earn-Back on its way 🎉",
	paragraphs: [
		"Congratulations on completing Intro to Systems!",
		"Your Earn-Back of ₦7,125 is on its way back to your original payment method. Refunds usually land within 5–10 business days, depending on your bank.",
	],
	cta: "View my learning",
	ctaUrl: "https://dextalearning.com/learn/mine",
};

export default NotificationEmail;
