import { Text } from "@react-email/components";
import { CtaButton, EmailLayout } from "./components/email-layout";
import { text } from "./theme";

/** Password reset link. */
export function PasswordResetEmail({ url }: { url: string }) {
	return (
		<EmailLayout
			preview="Reset your DextaLearning password"
			heading="Reset your password"
		>
			<Text style={text.lead}>
				We received a request to reset your password. Click below to choose a
				new one. If it wasn't you, ignore this email — your password stays
				unchanged.
			</Text>
			<CtaButton href={url}>Reset password</CtaButton>
			<Text style={text.fine}>This link expires in 1 hour.</Text>
		</EmailLayout>
	);
}

PasswordResetEmail.PreviewProps = {
	url: "https://dextalearning.com/reset?token=preview-token",
};

export default PasswordResetEmail;
