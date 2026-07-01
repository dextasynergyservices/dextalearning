import { Text } from "@react-email/components";
import { CtaButton, EmailLayout } from "./components/email-layout";
import { text } from "./theme";

/** Passwordless sign-in link. */
export function MagicLinkEmail({ url }: { url: string }) {
	return (
		<EmailLayout
			preview="Your DextaLearning sign-in link"
			heading="Sign in to DextaLearning"
		>
			<Text style={text.lead}>
				Click below to sign in. This link expires shortly and can only be used
				once.
			</Text>
			<CtaButton href={url}>Sign in</CtaButton>
			<Text style={text.fine}>
				If you didn't request this, you can safely ignore this email.
			</Text>
		</EmailLayout>
	);
}

MagicLinkEmail.PreviewProps = {
	url: "https://dextalearning.com/magic?token=preview-token",
};

export default MagicLinkEmail;
