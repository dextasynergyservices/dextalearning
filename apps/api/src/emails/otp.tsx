import { Text } from "@react-email/components";
import { EmailLayout, OtpCode } from "./components/email-layout";
import { text } from "./theme";

/** Standalone one-time code (resend / code sign-in). */
export function OtpEmail({ otp }: { otp: string }) {
	return (
		<EmailLayout
			preview="Your DextaLearning verification code"
			heading="Your verification code"
		>
			<Text style={text.hint}>
				Enter this code to continue (expires in 10 minutes):
			</Text>
			<OtpCode code={otp} />
			<Text style={text.fine}>
				If you didn't request this, you can safely ignore this email.
			</Text>
		</EmailLayout>
	);
}

OtpEmail.PreviewProps = { otp: "428193" };

export default OtpEmail;
