import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Table/column names below are raw Postgres identifiers, not Prisma model
 * names — apps/api/prisma/schema.prisma `@@map`s most of them (e.g. `User` →
 * `users`, `emailVerified` → `email_verified`). Always check the schema
 * before adding a query here; getting this wrong fails silently as "relation
 * does not exist", not a type error, since apps/web has no Prisma client of
 * its own (kept deliberately raw-SQL rather than importing apps/api's
 * generated client, to avoid a cross-app dependency for test-only code).
 */
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
	const databaseUrl = process.env.TEST_DATABASE_URL;
	if (!databaseUrl) {
		throw new Error(
			"TEST_DATABASE_URL is not set — did playwright.config.ts's globalSetup run?",
		);
	}
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end();
	}
}

/**
 * Flips `emailVerified` directly in the test DB, mirroring the shortcut
 * apps/api/test/e2e/support/auth.ts already uses: `requireEmailVerification:
 * true` blocks sign-in for a fresh registration, and dev mode never actually
 * delivers the verification email (no RESEND_API_KEY — see
 * apps/api/src/common/email.ts), so there's no real code to read. Verifying
 * the email itself is out of scope for the auth golden path; getting past it
 * to reach login is the point.
 */
export async function verifyUserEmail(email: string): Promise<void> {
	await withClient((client) =>
		client.query(
			`UPDATE "users" SET "email_verified" = true WHERE email = $1`,
			[email],
		),
	);
}

export async function promoteToAdmin(email: string): Promise<void> {
	await withClient((client) =>
		client.query(`UPDATE "users" SET "role" = 'admin' WHERE email = $1`, [
			email,
		]),
	);
}

/**
 * Seeds a published course → module → text lesson → course-final assessment
 * → one MCQ question, directly in Postgres. This setup (course authoring)
 * isn't itself under test here — the Learner core loop spec is testing
 * enrolment/lesson/assessment-taking, so its fixtures are seeded the same way
 * apps/api's own integration tests seed via `factories.ts`, just via raw SQL
 * since apps/web has no Prisma client.
 */
export async function seedLearnerCourse(): Promise<{
	courseId: string;
	courseSlug: string;
	lessonId: string;
	assessmentId: string;
}> {
	return withClient(async (client) => {
		const slug = `e2e-course-${randomUUID().slice(0, 8)}`;
		const courseRes = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free)
			 VALUES ($1, $2, 'published', true) RETURNING id`,
			["Spaced Repetition Basics", slug],
		);
		const courseId = courseRes.rows[0].id;

		const moduleRes = await client.query<{ id: string }>(
			`INSERT INTO "modules" (course_id, title, order_index)
			 VALUES ($1, 'Getting started', 1) RETURNING id`,
			[courseId],
		);
		const moduleId = moduleRes.rows[0].id;

		const lessonRes = await client.query<{ id: string }>(
			`INSERT INTO "lessons" (module_id, title, content_type, content_text, order_index)
			 VALUES ($1, 'What is spacing?', 'text', '<p>Spacing beats cramming.</p>', 1) RETURNING id`,
			[moduleId],
		);
		const lessonId = lessonRes.rows[0].id;

		const assessmentRes = await client.query<{ id: string }>(
			`INSERT INTO "assessments" (course_id, scope, type, title, pass_mark)
			 VALUES ($1, 'course_final', 'quiz', 'Module quiz', 50) RETURNING id`,
			[courseId],
		);
		const assessmentId = assessmentRes.rows[0].id;

		await client.query(
			`INSERT INTO "questions" (assessment_id, type, body, options_json, correct_answer, points, order_index)
			 VALUES ($1, 'mcq', 'Which technique spreads study sessions over time?', $2, 'Spaced repetition', 1, 1)`,
			[
				assessmentId,
				JSON.stringify([
					"Cramming",
					"Spaced repetition",
					"Highlighting",
					"Re-reading",
				]),
			],
		);

		return { courseId, courseSlug: slug, lessonId, assessmentId };
	});
}

/** Looks up a lesson created through the UI, which has no visible id. Titles
 * in these specs are randomized per run, so most-recent-by-title is unambiguous. */
export async function findLessonIdByTitle(title: string): Promise<string> {
	return withClient(async (client) => {
		const res = await client.query<{ id: string }>(
			`SELECT id FROM "lessons" WHERE title = $1 ORDER BY created_at DESC LIMIT 1`,
			[title],
		);
		if (res.rows.length === 0) {
			throw new Error(`No lesson found with title "${title}"`);
		}
		return res.rows[0].id;
	});
}

/**
 * Fixes up a UI-created lesson so `publishCourse` (apps/api
 * authoring.service.ts:236) stops reporting `missing_transcript` /
 * `empty_text` — mirrors seeding a transcript the same way an instructor
 * would via the lesson editor, without driving that separate (already
 * covered) form here.
 */
export async function makeLessonPublishable(lessonId: string): Promise<void> {
	await withClient((client) =>
		client.query(
			`UPDATE "lessons"
			 SET content_type = 'text', content_text = $2, transcript_text = $2
			 WHERE id = $1`,
			[lessonId, "<p>Seeded content for the Phase F golden path.</p>"],
		),
	);
}

/** A published course flagged for the admin "feature requests" queue. */
export async function seedFeatureRequestCourse(): Promise<{
	courseId: string;
	title: string;
}> {
	return withClient(async (client) => {
		const title = `Feature Me ${randomUUID().slice(0, 8)}`;
		const slug = `e2e-feature-${randomUUID().slice(0, 8)}`;
		const res = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free, feature_requested, is_featured)
			 VALUES ($1, $2, 'published', true, true, false) RETURNING id`,
			[title, slug],
		);
		return { courseId: res.rows[0].id, title };
	});
}

export async function seedCohort(): Promise<{ cohortId: string }> {
	return withClient(async (client) => {
		const slug = `e2e-cohort-${randomUUID().slice(0, 8)}`;
		const res = await client.query<{ id: string }>(
			`INSERT INTO "cohorts" (title, slug, status, is_free)
			 VALUES ('E2E Cohort', $1, 'draft', true) RETURNING id`,
			[slug],
		);
		return { cohortId: res.rows[0].id };
	});
}

export async function findUserIdByEmail(email: string): Promise<string> {
	return withClient(async (client) => {
		const res = await client.query<{ id: string }>(
			`SELECT id FROM "users" WHERE email = $1`,
			[email],
		);
		if (res.rows.length === 0) {
			throw new Error(`No user found with email "${email}"`);
		}
		return res.rows[0].id;
	});
}

/**
 * onboarding.tsx navigates to /instructor (or /dashboard) in a `finally`
 * block regardless of whether the save API call actually succeeded — the
 * redirect alone doesn't prove the real business outcome, so check the DB.
 */
export async function isOnboarded(email: string): Promise<boolean> {
	return withClient(async (client) => {
		const res = await client.query<{ onboarded: boolean }>(
			`SELECT onboarded_at IS NOT NULL AS onboarded FROM "users" WHERE email = $1`,
			[email],
		);
		return res.rows[0]?.onboarded ?? false;
	});
}

/**
 * A bare published course with no modules — just something to attach to a
 * path/cohort in tests where course *creation* isn't the point. Pass
 * `ownerId` when the test actor is a plain instructor, not admin: paths.service.ts's
 * `availableCourses` query is scoped to `createdBy: user.id` for non-admins
 * (`user.role === "admin" ? {} : { createdBy: user.id }`), so an unowned
 * course silently never appears in that instructor's "add a course" list.
 */
export async function seedBareCourse(ownerId?: string): Promise<{
	courseId: string;
	title: string;
}> {
	return withClient(async (client) => {
		const title = `Bare Course ${randomUUID().slice(0, 8)}`;
		const slug = `e2e-bare-${randomUUID().slice(0, 8)}`;
		const res = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free, created_by)
			 VALUES ($1, $2, 'published', true, $3) RETURNING id`,
			[title, slug, ownerId ?? null],
		);
		return { courseId: res.rows[0].id, title };
	});
}

async function findIdByTitle(table: string, title: string): Promise<string> {
	return withClient(async (client) => {
		const res = await client.query<{ id: string }>(
			`SELECT id FROM "${table}" WHERE title = $1 ORDER BY created_at DESC LIMIT 1`,
			[title],
		);
		if (res.rows.length === 0) {
			throw new Error(`No row found in "${table}" with title "${title}"`);
		}
		return res.rows[0].id;
	});
}

export const findPathIdByTitle = (title: string) =>
	findIdByTitle("learning_paths", title);
export const findCohortIdByTitle = (title: string) =>
	findIdByTitle("cohorts", title);
export const findBlogPostIdByTitle = (title: string) =>
	findIdByTitle("blog_posts", title);

/** Path publish requires no start-date gate, but Cohort publish does — set
 * directly rather than driving whatever date-picker widget the settings form
 * uses, same simplification as `makeLessonPublishable`'s transcript shortcut. */
export async function setCohortStartDate(cohortId: string): Promise<void> {
	await withClient((client) =>
		client.query(`UPDATE "cohorts" SET starts_at = now() WHERE id = $1`, [
			cohortId,
		]),
	);
}

/** Blog publish requires non-empty body_html — seeded directly rather than
 * driving the Tiptap editor, same reasoning as the transcript/start-date shortcuts. */
export async function setBlogPostBody(
	postId: string,
	html: string,
): Promise<void> {
	await withClient((client) =>
		client.query(`UPDATE "blog_posts" SET body_html = $2 WHERE id = $1`, [
			postId,
			html,
		]),
	);
}

/** A manually-graded project (no rubric → the instructor grading dialog's
 * "Score %" fallback field) attached to its own bare course. */
export async function seedProjectForGrading(): Promise<{ projectId: string }> {
	return withClient(async (client) => {
		const slug = `e2e-grading-${randomUUID().slice(0, 8)}`;
		const courseRes = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free)
			 VALUES ('Grading Course', $1, 'published', true) RETURNING id`,
			[slug],
		);
		const projectRes = await client.query<{ id: string }>(
			`INSERT INTO "projects" (course_id, scope, title, submission_types, grading_type, pass_mark, order_index)
			 VALUES ($1, 'course', 'Capstone write-up', $2, 'manual', 50, 1) RETURNING id`,
			[courseRes.rows[0].id, ["text_submission"]],
		);
		return { projectId: projectRes.rows[0].id };
	});
}

/** A peer-reviewed project (1 review required, 1 rubric criterion) attached
 * to its own bare course. */
export async function seedProjectForPeerReview(): Promise<{
	projectId: string;
}> {
	return withClient(async (client) => {
		const slug = `e2e-peer-${randomUUID().slice(0, 8)}`;
		const courseRes = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free)
			 VALUES ('Peer Review Course', $1, 'published', true) RETURNING id`,
			[slug],
		);
		const projectRes = await client.query<{ id: string }>(
			`INSERT INTO "projects" (course_id, scope, title, submission_types, grading_type, peer_review_count, rubric_json, pass_mark, order_index)
			 VALUES ($1, 'course', 'Peer-reviewed essay', $2, 'peer_review', 1, $3, 50, 1) RETURNING id`,
			[
				courseRes.rows[0].id,
				["text_submission"],
				JSON.stringify([{ id: "quality", label: "Quality", maxPoints: 10 }]),
			],
		);
		return { projectId: projectRes.rows[0].id };
	});
}

/** Stands in for "a classmate already submitted" — a second learner + their
 * submission, seeded directly since driving a full second registration isn't
 * the point of the peer-review test (the real learner's own review-taking is). */
export async function seedOtherLearnerSubmission(
	projectId: string,
): Promise<void> {
	await withClient(async (client) => {
		const email = `e2e-classmate-${randomUUID().slice(0, 8)}@example.com`;
		const userRes = await client.query<{ id: string }>(
			`INSERT INTO "users" (email, first_name, last_name, role, email_verified, updated_at)
			 VALUES ($1, 'Classmate', 'Learner', 'learner', true, now()) RETURNING id`,
			[email],
		);
		await client.query(
			`INSERT INTO "project_submissions" (project_id, user_id, attempt_number, submitted_at, text_content)
			 VALUES ($1, $2, 1, now(), 'A classmate''s submission for peer review.')`,
			[projectId, userRes.rows[0].id],
		);
	});
}

/**
 * Reads a real 6-digit email-OTP code back out of Better Auth's own
 * `verifications` table (`Verification` model, `schema.prisma:384-393`) —
 * dev mode never actually delivers email (no RESEND_API_KEY, see
 * apps/api/src/common/email.ts) and the log line it prints doesn't include
 * the code, so this is the only way to drive the REAL verify/reset forms
 * instead of the `verifyUserEmail` DB-shortcut. Better Auth's emailOTP plugin
 * stores `identifier = "<type>-<email>"`, `value = "<otp>:<attemptCount>"`
 * (plain text, default `storeOTP` setting — confirmed unoverridden in
 * auth.config.ts).
 */
export async function getEmailOtp(
	email: string,
	type: "email-verification-otp" | "forget-password-otp",
): Promise<string> {
	return withClient(async (client) => {
		const res = await client.query<{ otp: string }>(
			`SELECT split_part(value, ':', 1) AS otp FROM "verifications"
			 WHERE identifier = $1 ORDER BY created_at DESC LIMIT 1`,
			[`${type}-${email}`],
		);
		if (res.rows.length === 0) {
			throw new Error(`No ${type} OTP found for "${email}"`);
		}
		return res.rows[0].otp;
	});
}

/**
 * Reads a real magic-link token back out of the same `verifications` table.
 * Unlike the OTP flows, the magic-link plugin stores the token itself as
 * `identifier` and a JSON blob (`{email, name}`) as `value` — inverted from
 * the OTP shape, so this can't share `getEmailOtp`'s query. Visiting
 * `GET /api/auth/magic-link/verify?token=<this>&callbackURL=<url>` completes
 * sign-in and redirects, same as clicking the real emailed link would.
 */
export async function getMagicLinkToken(email: string): Promise<string> {
	return withClient(async (client) => {
		const res = await client.query<{ identifier: string }>(
			`SELECT identifier FROM "verifications"
			 WHERE value LIKE $1 ORDER BY created_at DESC LIMIT 1`,
			[`%"email":"${email}"%`],
		);
		if (res.rows.length === 0) {
			throw new Error(`No magic-link token found for "${email}"`);
		}
		return res.rows[0].identifier;
	});
}

/**
 * A published Path with one course (its own module/lesson) attached, for the
 * learner path-enrolment golden path — same shape as `seedLearnerCourse`,
 * just wrapped in a `learning_paths`/`path_courses` pair. `path_courses` has
 * no own `id`/`status` column (composite PK on `path_id, course_id`).
 */
export async function seedLearnerPath(): Promise<{
	pathId: string;
	pathSlug: string;
	courseId: string;
	lessonId: string;
}> {
	return withClient(async (client) => {
		const pathSlug = `e2e-path-${randomUUID().slice(0, 8)}`;
		const pathRes = await client.query<{ id: string }>(
			`INSERT INTO "learning_paths" (title, slug, status, is_free)
			 VALUES ('Frontend Fundamentals', $1, 'published', true) RETURNING id`,
			[pathSlug],
		);
		const pathId = pathRes.rows[0].id;

		const courseSlug = `e2e-path-course-${randomUUID().slice(0, 8)}`;
		const courseRes = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free)
			 VALUES ('HTML Basics', $1, 'published', true) RETURNING id`,
			[courseSlug],
		);
		const courseId = courseRes.rows[0].id;

		await client.query(
			`INSERT INTO "path_courses" (path_id, course_id, order_index, is_required)
			 VALUES ($1, $2, 1, true)`,
			[pathId, courseId],
		);

		const moduleRes = await client.query<{ id: string }>(
			`INSERT INTO "modules" (course_id, title, order_index)
			 VALUES ($1, 'Getting started', 1) RETURNING id`,
			[courseId],
		);
		const lessonRes = await client.query<{ id: string }>(
			`INSERT INTO "lessons" (module_id, title, content_type, content_text, order_index)
			 VALUES ($1, 'Tags and elements', 'text', '<p>HTML is made of tags.</p>', 1) RETURNING id`,
			[moduleRes.rows[0].id],
		);

		return { pathId, pathSlug, courseId, lessonId: lessonRes.rows[0].id };
	});
}

/**
 * A published, `open` Cohort with one course (its own module/lesson)
 * attached — same shape as `seedLearnerPath`, swapping the join table.
 * Status must be `'open'`, not `'draft'` — `enrollment.service.ts`'s
 * `assertOpen()` gates cohort enrolment on `status === 'open'` specifically
 * (unlike `seedCohort()` elsewhere in this file, which seeds `'draft'` for
 * authoring-flow tests that publish it themselves). `cohort_courses` has no
 * `is_required` column (unlike `path_courses`).
 */
export async function seedLearnerCohort(): Promise<{
	cohortId: string;
	cohortSlug: string;
	courseId: string;
	lessonId: string;
}> {
	return withClient(async (client) => {
		const cohortSlug = `e2e-cohort-${randomUUID().slice(0, 8)}`;
		const cohortRes = await client.query<{ id: string }>(
			`INSERT INTO "cohorts" (title, slug, status, is_free)
			 VALUES ('January Cohort', $1, 'open', true) RETURNING id`,
			[cohortSlug],
		);
		const cohortId = cohortRes.rows[0].id;

		const courseSlug = `e2e-cohort-course-${randomUUID().slice(0, 8)}`;
		const courseRes = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free)
			 VALUES ('CSS Basics', $1, 'published', true) RETURNING id`,
			[courseSlug],
		);
		const courseId = courseRes.rows[0].id;

		await client.query(
			`INSERT INTO "cohort_courses" (cohort_id, course_id, order_index)
			 VALUES ($1, $2, 1)`,
			[cohortId, courseId],
		);

		const moduleRes = await client.query<{ id: string }>(
			`INSERT INTO "modules" (course_id, title, order_index)
			 VALUES ($1, 'Getting started', 1) RETURNING id`,
			[courseId],
		);
		const lessonRes = await client.query<{ id: string }>(
			`INSERT INTO "lessons" (module_id, title, content_type, content_text, order_index)
			 VALUES ($1, 'Selectors and properties', 'text', '<p>CSS styles HTML elements.</p>', 1) RETURNING id`,
			[moduleRes.rows[0].id],
		);

		return {
			cohortId,
			cohortSlug,
			courseId,
			lessonId: lessonRes.rows[0].id,
		};
	});
}

/** Course + path + cohort + assessment with camera anti-cheat required. */
export async function seedCameraAssessment(): Promise<{
	courseSlug: string;
	assessmentId: string;
}> {
	return withClient(async (client) => {
		const slug = `e2e-camera-${randomUUID().slice(0, 8)}`;
		const courseRes = await client.query<{ id: string }>(
			`INSERT INTO "courses" (title, slug, status, is_free)
			 VALUES ('Proctored Basics', $1, 'published', true) RETURNING id`,
			[slug],
		);
		const assessmentRes = await client.query<{ id: string }>(
			`INSERT INTO "assessments" (course_id, scope, type, title, pass_mark, anticheat_camera_required)
			 VALUES ($1, 'course_final', 'quiz', 'Proctored quiz', 50, true) RETURNING id`,
			[courseRes.rows[0].id],
		);
		await client.query(
			`INSERT INTO "questions" (assessment_id, type, body, options_json, correct_answer, points, order_index)
			 VALUES ($1, 'mcq', 'Two plus two equals?', $2, '4', 1, 1)`,
			[assessmentRes.rows[0].id, JSON.stringify(["3", "4", "5", "6"])],
		);
		return { courseSlug: slug, assessmentId: assessmentRes.rows[0].id };
	});
}
