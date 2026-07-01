import { Text } from "@react-email/components";
import { CtaButton, EmailLayout, OtpCode } from "./components/email-layout";
import { text } from "./theme";

/** Dual-channel verification: a magic link AND a 6-digit code in one email. */
export function VerifyEmail({
	magicLink,
	otp,
}: {
	magicLink: string;
	otp: string;
}) {
	return (
		<EmailLayout
			preview="Verify your DextaLearning account"
			heading="Verify your email"
		>
			<Text style={text.lead}>
				Welcome to DextaLearning! Confirm your email to start learning.
			</Text>
			<CtaButton href={magicLink}>Verify my email</CtaButton>
			<Text style={{ ...text.hint, marginTop: "24px" }}>
				Or enter this code (expires in 10 minutes):
			</Text>
			<OtpCode code={otp} />
			<Text style={text.fine}>
				The link expires in 24 hours. If you didn't create an account, you can
				safely ignore this email.
			</Text>
		</EmailLayout>
	);
}

VerifyEmail.PreviewProps = {
	magicLink: "https://dextalearning.com/verify?token=preview-token",
	otp: "428193",
};

export default VerifyEmail;
