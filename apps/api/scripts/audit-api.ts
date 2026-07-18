/**
 * D7 WCAG-audit API: on :4100 against the disposable test DB, throttling OFF
 * (NODE_ENV=test) so the axe crawler can navigate freely. Never touches the dev
 * DB or the user's :3000 stack. Turnstile stays a no-op (no secret).
 */
import "dotenv/config";

if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL unset");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PORT = "4100";
process.env.NODE_ENV = "test";
// Let the :4180 audit preview hold a session (CORS + Better Auth trustedOrigins).
// localhost is same-site across ports, so the Lax dev cookie rides along.
process.env.FRONTEND_URL = "http://localhost:4180";
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.REDIS_URL;

import("../src/main.js");
