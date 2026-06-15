-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('learner', 'facilitator', 'instructor', 'admin');

-- CreateEnum
CREATE TYPE "payout_provider" AS ENUM ('paystack', 'stripe');

-- CreateEnum
CREATE TYPE "language_code" AS ENUM ('en', 'fr', 'es', 'pcm');

-- CreateEnum
CREATE TYPE "video_quality" AS ENUM ('1080p', '720p', '480p', '320p', '240p', '144p');

-- CreateEnum
CREATE TYPE "publish_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "course_level" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "path_level" AS ENUM ('beginner', 'intermediate', 'advanced', 'mixed');

-- CreateEnum
CREATE TYPE "lesson_content_type" AS ENUM ('video', 'text', 'pdf', 'audio');

-- CreateEnum
CREATE TYPE "caption_source" AS ENUM ('instructor');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('active', 'completed', 'dropped');

-- CreateEnum
CREATE TYPE "cohort_status" AS ENUM ('draft', 'open', 'active', 'closed');

-- CreateEnum
CREATE TYPE "cohort_exam_mode" AS ENUM ('unified', 'rolling', 'instructor', 'deadline_bound');

-- CreateEnum
CREATE TYPE "cohort_unlock_mode" AS ENUM ('all_at_once', 'progressive', 'scheduled');

-- CreateEnum
CREATE TYPE "grouping_mode" AS ENUM ('randomized', 'skill_based', 'balanced', 'manual');

-- CreateEnum
CREATE TYPE "group_member_role" AS ENUM ('member', 'lead');

-- CreateEnum
CREATE TYPE "assessment_scope" AS ENUM ('lesson_pre', 'lesson_post', 'module', 'course_final', 'path_final', 'cohort');

-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('quiz', 'assignment', 'peer_review');

-- CreateEnum
CREATE TYPE "assessment_grading_type" AS ENUM ('auto', 'manual', 'ai_assisted', 'peer');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('mcq', 'true_false', 'short_answer');

-- CreateEnum
CREATE TYPE "anti_cheat_event_type" AS ENUM ('tab_switch', 'focus_loss', 'copy_attempt', 'paste_attempt', 'right_click', 'keyboard_shortcut', 'fullscreen_exit', 'camera_face_missing', 'camera_multiple_faces', 'fast_answer', 'viewport_change', 'devtools_open');

-- CreateEnum
CREATE TYPE "severity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "project_scope" AS ENUM ('course', 'path', 'cohort');

-- CreateEnum
CREATE TYPE "project_grading_type" AS ENUM ('manual', 'peer_review', 'ai_assisted');

-- CreateEnum
CREATE TYPE "completable_entity_type" AS ENUM ('course', 'path', 'cohort');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'paid', 'failed', 'earn_back_issued');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('paystack', 'stripe');

-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "earn_back_status" AS ENUM ('pending', 'processed', 'failed', 'no_payout');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "branding_json" JSONB,
    "settings_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "other_names" VARCHAR(100),
    "full_name" VARCHAR(300),
    "role" "user_role" NOT NULL,
    "avatar_url" TEXT,
    "phone" VARCHAR(20),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "payout_provider" "payout_provider",
    "payout_account_json" JSONB,
    "payout_verified" BOOLEAN NOT NULL DEFAULT false,
    "language" "language_code" NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(50),
    "preferred_video_quality" "video_quality" NOT NULL DEFAULT '480p',
    "progress_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "thumbnail_key" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "is_earn_back_eligible" BOOLEAN NOT NULL DEFAULT false,
    "earn_back_deadline_days" INTEGER,
    "has_final_assessment" BOOLEAN NOT NULL DEFAULT true,
    "status" "publish_status",
    "created_by" UUID,
    "level" "course_level",
    "language" "language_code" NOT NULL DEFAULT 'en',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "total_duration_hours" DECIMAL(6,1),
    "enrolled_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "has_assessment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content_type" "lesson_content_type",
    "video_keys_json" JSONB,
    "video_duration_sec" INTEGER,
    "video_thumbnail_key" TEXT,
    "audio_key" TEXT,
    "audio_duration_sec" INTEGER,
    "audio_size_bytes" BIGINT,
    "content_text" TEXT,
    "pdf_key" TEXT,
    "caption_keys_json" JSONB,
    "transcript_text" TEXT,
    "transcript_uploaded_at" TIMESTAMPTZ(6),
    "min_video_watch_pct" DECIMAL(5,2) NOT NULL DEFAULT 80.00,
    "has_pre_quiz" BOOLEAN NOT NULL DEFAULT false,
    "has_post_quiz" BOOLEAN NOT NULL DEFAULT false,
    "post_quiz_pass_mark" DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    "is_downloadable" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_completions" (
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "time_spent_sec" INTEGER,
    "pre_quiz_score" DECIMAL(5,2),
    "post_quiz_score" DECIMAL(5,2),
    "video_watched_pct" DECIMAL(5,2),

    CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("user_id","lesson_id")
);

-- CreateTable
CREATE TABLE "lesson_captions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "language_code" "language_code" NOT NULL,
    "vtt_key" TEXT NOT NULL,
    "source" "caption_source" NOT NULL DEFAULT 'instructor',
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_captions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "thumbnail_key" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "is_earn_back_eligible" BOOLEAN NOT NULL DEFAULT false,
    "earn_back_deadline_days" INTEGER,
    "outcome_statement" TEXT,
    "estimated_hours" DECIMAL(6,1),
    "level" "path_level",
    "status" "publish_status",
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_courses" (
    "path_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "path_courses_pkey" PRIMARY KEY ("path_id","course_id")
);

-- CreateTable
CREATE TABLE "path_enrollments" (
    "path_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earn_back_deadline" TIMESTAMPTZ(6),
    "status" "enrollment_status",

    CONSTRAINT "path_enrollments_pkey" PRIMARY KEY ("path_id","user_id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "capacity" INTEGER,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "is_earn_back_eligible" BOOLEAN NOT NULL DEFAULT false,
    "exam_mode" "cohort_exam_mode",
    "unlock_mode" "cohort_unlock_mode",
    "grouping_mode" "grouping_mode" NOT NULL DEFAULT 'randomized',
    "target_group_size" INTEGER NOT NULL DEFAULT 5,
    "min_group_size" INTEGER NOT NULL DEFAULT 3,
    "max_group_size" INTEGER NOT NULL DEFAULT 8,
    "status" "cohort_status",
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "seats_filled" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_courses" (
    "cohort_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "order_index" INTEGER,

    CONSTRAINT "cohort_courses_pkey" PRIMARY KEY ("cohort_id","course_id")
);

-- CreateTable
CREATE TABLE "cohort_instructors" (
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "cohort_instructors_pkey" PRIMARY KEY ("cohort_id","user_id")
);

-- CreateTable
CREATE TABLE "cohort_facilitators" (
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "cohort_facilitators_pkey" PRIMARY KEY ("cohort_id","user_id")
);

-- CreateTable
CREATE TABLE "cohort_enrollments" (
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earn_back_deadline" TIMESTAMPTZ(6),
    "status" "enrollment_status",

    CONSTRAINT "cohort_enrollments_pkey" PRIMARY KEY ("cohort_id","user_id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID,
    "name" VARCHAR(100),
    "type" "grouping_mode",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "group_member_role" NOT NULL DEFAULT 'member',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "group_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID,
    "user_id" UUID,
    "content" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "lesson_id" UUID,
    "module_id" UUID,
    "course_id" UUID,
    "path_id" UUID,
    "cohort_id" UUID,
    "scope" "assessment_scope" NOT NULL,
    "type" "assessment_type",
    "title" VARCHAR(200),
    "pass_mark" DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    "time_limit_minutes" INTEGER,
    "max_retakes" INTEGER,
    "retake_cooldown_hours" INTEGER,
    "question_pool_size" INTEGER,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_answers" BOOLEAN NOT NULL DEFAULT true,
    "anticheat_tab_switch_limit" INTEGER NOT NULL DEFAULT 3,
    "anticheat_fullscreen_required" BOOLEAN NOT NULL DEFAULT false,
    "anticheat_camera_required" BOOLEAN NOT NULL DEFAULT false,
    "anticheat_copy_paste_blocked" BOOLEAN NOT NULL DEFAULT true,
    "anticheat_time_per_question_flag_seconds" INTEGER NOT NULL DEFAULT 2,
    "scheduled_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "grading_type" "assessment_grading_type",
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID,
    "type" "question_type",
    "body" TEXT NOT NULL,
    "options_json" JSONB,
    "correct_answer" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order_index" INTEGER,
    "language" "language_code" NOT NULL DEFAULT 'en',

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID,
    "user_id" UUID,
    "attempt_number" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "auto_submitted" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "answers_json" JSONB,
    "score" DECIMAL(5,2),
    "passed" BOOLEAN,
    "graded_at" TIMESTAMPTZ(6),
    "feedback" TEXT,
    "integrity_score" INTEGER NOT NULL DEFAULT 100,
    "flag_count" INTEGER NOT NULL DEFAULT 0,
    "invalidated" BOOLEAN NOT NULL DEFAULT false,
    "invalidated_by" UUID,
    "invalidated_reason" TEXT,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_anti_cheat_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID,
    "event_type" "anti_cheat_event_type" NOT NULL,
    "severity" "severity" NOT NULL DEFAULT 'medium',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,
    "screenshot_key" TEXT,

    CONSTRAINT "assessment_anti_cheat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "course_id" UUID,
    "path_id" UUID,
    "cohort_id" UUID,
    "scope" "project_scope" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "rubric_json" JSONB,
    "submission_types" TEXT[] DEFAULT ARRAY['file_upload']::TEXT[],
    "allowed_file_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_file_size_mb" INTEGER NOT NULL DEFAULT 50,
    "pass_mark" DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    "grading_type" "project_grading_type" NOT NULL DEFAULT 'manual',
    "peer_review_count" INTEGER NOT NULL DEFAULT 2,
    "due_at" TIMESTAMPTZ(6),
    "order_index" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID,
    "user_id" UUID,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text_content" TEXT,
    "file_keys_json" JSONB,
    "url_submission" TEXT,
    "graded_by" UUID,
    "graded_at" TIMESTAMPTZ(6),
    "score" DECIMAL(5,2),
    "passed" BOOLEAN,
    "feedback" TEXT,
    "rubric_scores_json" JSONB,
    "peer_reviews_assigned" INTEGER NOT NULL DEFAULT 0,
    "peer_reviews_completed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_peer_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID,
    "reviewer_user_id" UUID,
    "rubric_scores_json" JSONB,
    "feedback" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_peer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completion_status" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "entity_type" "completable_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "all_lessons_done" BOOLEAN NOT NULL DEFAULT false,
    "all_module_assessments_passed" BOOLEAN NOT NULL DEFAULT false,
    "final_assessment_passed" BOOLEAN NOT NULL DEFAULT false,
    "all_projects_passed" BOOLEAN NOT NULL DEFAULT false,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "earn_back_triggered" BOOLEAN NOT NULL DEFAULT false,
    "certificate_issued" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "completion_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "entity_type" "completable_entity_type",
    "entity_id" UUID,
    "amount" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "platform_amount" DECIMAL(10,2),
    "instructor_amount" DECIMAL(10,2),
    "instructor_id" UUID,
    "status" "order_status",
    "provider" "payment_provider",
    "provider_ref" TEXT,
    "idempotency_key" TEXT,
    "is_earn_back_eligible" BOOLEAN NOT NULL DEFAULT false,
    "earn_back_deadline" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID,
    "instructor_id" UUID,
    "amount" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "provider" "payment_provider",
    "provider_ref" TEXT,
    "status" "payout_status",
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "failed_reason" TEXT,

    CONSTRAINT "instructor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earn_back_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID,
    "user_id" UUID,
    "amount_paid" DECIMAL(10,2),
    "days_late" INTEGER NOT NULL DEFAULT 0,
    "earn_back_amount" DECIMAL(10,2),
    "forfeited_amount" DECIMAL(10,2),
    "forfeited_platform_cut" DECIMAL(10,2),
    "forfeited_instructor_cut" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "provider" VARCHAR(20),
    "provider_ref" TEXT,
    "status" "earn_back_status",
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "failed_reason" TEXT,

    CONSTRAINT "earn_back_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "entity_type" "completable_entity_type",
    "entity_id" UUID,
    "tenant_id" UUID,
    "cert_key" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verify_token" TEXT NOT NULL,
    "learner_name" VARCHAR(300),
    "content_title" VARCHAR(200),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "entity_type" VARCHAR(30),
    "entity_id" UUID,
    "event_type" VARCHAR(30),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID,
    "user_id" UUID,
    "score_type" VARCHAR(20),
    "score" DECIMAL(10,2),
    "rank" INTEGER,
    "period" VARCHAR(20),
    "computed_at" TIMESTAMPTZ(6),

    CONSTRAINT "leaderboard_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_captions_lesson_id_language_code_key" ON "lesson_captions"("lesson_id", "language_code");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_slug_key" ON "learning_paths"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cohorts_slug_key" ON "cohorts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "completion_status_user_id_entity_type_entity_id_key" ON "completion_status"("user_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verify_token_key" ON "certificates"("verify_token");

-- CreateIndex
CREATE INDEX "idx_progress_events_user_type_date" ON "progress_events"("user_id", "entity_type", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_captions" ADD CONSTRAINT "lesson_captions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_captions" ADD CONSTRAINT "lesson_captions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_courses" ADD CONSTRAINT "cohort_courses_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_courses" ADD CONSTRAINT "cohort_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_instructors" ADD CONSTRAINT "cohort_instructors_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_instructors" ADD CONSTRAINT "cohort_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_instructors" ADD CONSTRAINT "cohort_instructors_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_facilitators" ADD CONSTRAINT "cohort_facilitators_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_facilitators" ADD CONSTRAINT "cohort_facilitators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_facilitators" ADD CONSTRAINT "cohort_facilitators_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_enrollments" ADD CONSTRAINT "cohort_enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_enrollments" ADD CONSTRAINT "cohort_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_invalidated_by_fkey" FOREIGN KEY ("invalidated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_anti_cheat_logs" ADD CONSTRAINT "assessment_anti_cheat_logs_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_peer_reviews" ADD CONSTRAINT "project_peer_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "project_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_peer_reviews" ADD CONSTRAINT "project_peer_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_status" ADD CONSTRAINT "completion_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_payouts" ADD CONSTRAINT "instructor_payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_payouts" ADD CONSTRAINT "instructor_payouts_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earn_back_transactions" ADD CONSTRAINT "earn_back_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earn_back_transactions" ADD CONSTRAINT "earn_back_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

