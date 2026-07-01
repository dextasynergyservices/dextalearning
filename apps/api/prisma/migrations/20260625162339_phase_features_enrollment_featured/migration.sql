-- AlterTable
ALTER TABLE "assessment_attempts" ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escalated_at" TIMESTAMPTZ(6),
ADD COLUMN     "escalated_reason" TEXT;

-- AlterTable
ALTER TABLE "cohorts" ADD COLUMN     "earn_back_percentage" INTEGER;

-- AlterTable
ALTER TABLE "completion_status" ADD COLUMN     "progress_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "earn_back_percentage" INTEGER,
ADD COLUMN     "estimated_duration" VARCHAR(120),
ADD COLUMN     "feature_requested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN     "earn_back_percentage" INTEGER,
ADD COLUMN     "estimated_duration" VARCHAR(120),
ADD COLUMN     "feature_requested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "intro_for_cohort_id" UUID,
ADD COLUMN     "intro_for_path_id" UUID,
ADD COLUMN     "is_preview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transcript_cues_json" JSONB,
ALTER COLUMN "module_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "course_enrollments" (
    "course_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earn_back_deadline" TIMESTAMPTZ(6),
    "status" "enrollment_status",

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("course_id","user_id")
);

-- CreateTable
CREATE TABLE "cohort_paths" (
    "cohort_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "order_index" INTEGER,

    CONSTRAINT "cohort_paths_pkey" PRIMARY KEY ("cohort_id","path_id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "excerpt" TEXT,
    "category" VARCHAR(80),
    "cover_key" TEXT,
    "body_html" TEXT,
    "author_name" VARCHAR(120),
    "read_minutes" INTEGER,
    "status" "publish_status",
    "published_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_cache" (
    "source_hash" VARCHAR(64) NOT NULL,
    "language" "language_code" NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("source_hash","language")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_intro_for_path_id_key" ON "lessons"("intro_for_path_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_intro_for_cohort_id_key" ON "lessons"("intro_for_cohort_id");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_intro_for_path_id_fkey" FOREIGN KEY ("intro_for_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_intro_for_cohort_id_fkey" FOREIGN KEY ("intro_for_cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_paths" ADD CONSTRAINT "cohort_paths_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_paths" ADD CONSTRAINT "cohort_paths_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

