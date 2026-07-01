import { render } from "@react-email/render";
import { MagicLinkEmail } from "./magic-link";
import { OtpEmail } from "./otp";
import { PasswordResetEmail } from "./password-reset";
import { VerifyEmail } from "./verify-email";
import { WelcomeEmail } from "./welcome";

/**
 * Renders each React Email template to an HTML string for the mail provider.
 * Keeps all JSX in `.tsx` so the plain `common/email.ts` orchestrator stays
 * JSX-free. Add a new `render*` function here per template.
 */
export const renderVerifyEmail = (props: { magicLink: string; otp: string }) =>
	render(<VerifyEmail {...props} />);

export const renderMagicLinkEmail = (props: { url: string }) =>
	render(<MagicLinkEmail {...props} />);

export const renderOtpEmail = (props: { otp: string }) =>
	render(<OtpEmail {...props} />);

export const renderPasswordResetEmail = (props: { url: string }) =>
	render(<PasswordResetEmail {...props} />);

export const renderWelcomeEmail = (props: { name?: string; ctaUrl?: string }) =>
	render(<WelcomeEmail {...props} />);
