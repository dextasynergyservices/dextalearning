import { Text } from "@react-email/components";
import { CtaButton, EmailLayout } from "./components/email-layout";
import { text } from "./theme";

/**
 * Post-verification welcome. Not yet wired into a flow — included as the
 * foundation/example for future lifecycle emails (onboarding, course enrolment,
 * earn-back notices, streak reminders, etc.).
 */
export function WelcomeEmail({
	name,
	ctaUrl = "https://dextalearning.com/dashboard",
}: {
	name?: string;
	ctaUrl?: string;
}) {
	return (
		<EmailLayout
			preview="Welcome to DextaLearning"
			heading={name ? `Welcome, ${name}!` : "Welcome to DextaLearning"}
		>
			<Text style={text.lead}>
				Your account is ready. DextaLearning is built around how memory actually
				works — short lessons, spaced recall, and projects that prove what you
				can do. Pick a course and start building.
			</Text>
			<CtaButton href={ctaUrl}>Go to my dashboard</CtaButton>
			<Text style={text.fine}>
				Questions? Just reply to this email — a real person reads it.
			</Text>
		</EmailLayout>
	);
}

WelcomeEmail.PreviewProps = {
	name: "Ada",
	ctaUrl: "https://dextalearning.com/dashboard",
};

export default WelcomeEmail;
