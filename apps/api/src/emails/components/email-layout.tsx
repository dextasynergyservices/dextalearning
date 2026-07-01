import {
	Body,
	Button,
	Container,
	Font,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { colors, FONTS, fontStack, monoStack } from "../theme";

/**
 * Branded shell shared by every transactional email — dark header with the
 * DextaLearning wordmark, white card, footer. Templates supply a `preview`
 * (inbox snippet), an optional `heading`, and their body.
 */
export function EmailLayout({
	preview,
	heading,
	children,
}: {
	preview: string;
	heading?: string;
	children: ReactNode;
}) {
	return (
		<Html lang="en">
			<Head>
				{/* The real app fonts — Righteous (wordmark), DM Sans (body), Space
				    Grotesk (codes). Clients that support web fonts (Apple Mail, iOS)
				    render the brand type; others fall back to the system stacks. */}
				<Font
					fontFamily="DM Sans"
					fallbackFontFamily="Arial"
					webFont={{ url: FONTS.dmSans400, format: "woff2" }}
					fontWeight={400}
					fontStyle="normal"
				/>
				<Font
					fontFamily="DM Sans"
					fallbackFontFamily="Arial"
					webFont={{ url: FONTS.dmSans600, format: "woff2" }}
					fontWeight={600}
					fontStyle="normal"
				/>
				<Font
					fontFamily="Righteous"
					fallbackFontFamily="sans-serif"
					webFont={{ url: FONTS.righteous400, format: "woff2" }}
					fontWeight={400}
					fontStyle="normal"
				/>
				<Font
					fontFamily="Space Grotesk"
					fallbackFontFamily="monospace"
					webFont={{ url: FONTS.spaceGrotesk700, format: "woff2" }}
					fontWeight={700}
					fontStyle="normal"
				/>
			</Head>
			<Preview>{preview}</Preview>
			<Body style={main}>
				<Container style={card}>
					<Section style={header}>
						<Text style={brand}>
							Dexta<span style={{ color: colors.accent }}>Learning</span>
						</Text>
					</Section>
					<Section style={content}>
						{heading ? <Heading style={h1}>{heading}</Heading> : null}
						{children}
					</Section>
					<Hr style={hr} />
					<Section style={footerWrap}>
						<Text style={footerText}>
							© {new Date().getFullYear()} DextaLearning · dextalearning.com
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

/** Primary call-to-action button (verify / sign-in / reset links). */
export function CtaButton({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<Button href={href} style={cta}>
			{children}
		</Button>
	);
}

/** Large monospace one-time code block. */
export function OtpCode({ code }: { code: string }) {
	return <Text style={otp}>{code}</Text>;
}

const main: CSSProperties = {
	margin: 0,
	backgroundColor: colors.bg,
	fontFamily: fontStack,
	color: colors.ink,
	padding: "32px 16px",
};

const card: CSSProperties = {
	maxWidth: "480px",
	width: "100%",
	backgroundColor: colors.card,
	borderRadius: "16px",
	overflow: "hidden",
	boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const header: CSSProperties = {
	backgroundColor: colors.dark,
	padding: "24px 28px",
};

const brand: CSSProperties = {
	margin: 0,
	fontFamily: "'Righteous', Arial, sans-serif",
	fontSize: "22px",
	fontWeight: 700,
	color: "#ffffff",
};

const content: CSSProperties = { padding: "32px 28px" };

const h1: CSSProperties = {
	margin: "0 0 16px",
	fontSize: "22px",
	lineHeight: "28px",
	color: colors.ink,
	fontFamily: fontStack,
};

const cta: CSSProperties = {
	display: "inline-block",
	backgroundColor: colors.primary,
	color: "#ffffff",
	fontWeight: 600,
	fontSize: "15px",
	textDecoration: "none",
	padding: "12px 22px",
	borderRadius: "12px",
};

const otp: CSSProperties = {
	margin: "8px 0 4px",
	fontFamily: monoStack,
	fontSize: "30px",
	letterSpacing: "8px",
	fontWeight: 700,
	color: colors.primary,
};

const hr: CSSProperties = { borderColor: colors.border, margin: 0 };

const footerWrap: CSSProperties = { padding: "20px 28px" };

const footerText: CSSProperties = {
	margin: 0,
	color: colors.faint,
	fontSize: "12px",
	fontFamily: fontStack,
};
