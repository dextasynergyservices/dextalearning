// Illustrative Teacher Academy catalog data. This stands in for content that
// will come from the API; only UI chrome is localized (sample copy stays as-is).

export type CourseLevel = "beginner" | "intermediate" | "advanced";

export interface SampleLesson {
	title: string;
	minutes: number;
}

export interface SampleModule {
	title: string;
	lessons: SampleLesson[];
}

export interface SampleCourse {
	slug: string;
	title: string;
	summary: string;
	category: string;
	level: CourseLevel;
	durationHours: number;
	lessonCount: number;
	rating: number;
	enrolled: number;
	priceNgn: number;
	isEarnBack: boolean;
	instructorName: string;
	instructorTitle: string;
	outcomes: string[];
	modules: SampleModule[];
	faqs: { q: string; a: string }[];
}

export const COURSE_CATEGORIES = [
	"all",
	"pedagogy",
	"classroom",
	"edtech",
	"assessment",
	"leadership",
] as const;

export const SAMPLE_COURSES: SampleCourse[] = [
	{
		slug: "active-recall-classroom",
		title: "Active Recall in the Classroom",
		summary:
			"Turn passive lessons into durable learning with retrieval practice your students will actually enjoy.",
		category: "pedagogy",
		level: "beginner",
		durationHours: 4.5,
		lessonCount: 18,
		rating: 4.9,
		enrolled: 2143,
		priceNgn: 0,
		isEarnBack: false,
		instructorName: "Dr. Ngozi Eze",
		instructorTitle: "Learning scientist",
		outcomes: [
			"Design retrieval-based lessons in any subject",
			"Run low-stakes quizzes that boost memory, not anxiety",
			"Measure growth instead of grading by gut feel",
		],
		modules: [
			{
				title: "Why recall beats re-reading",
				lessons: [
					{ title: "The forgetting curve", minutes: 9 },
					{ title: "Testing as learning", minutes: 12 },
				],
			},
			{
				title: "Designing recall activities",
				lessons: [
					{ title: "Brain dumps & exit tickets", minutes: 11 },
					{ title: "Spaced quiz schedules", minutes: 14 },
				],
			},
		],
		faqs: [
			{
				q: "Do I need any special tools?",
				a: "No. Everything works with pen, paper, and a whiteboard — digital is optional.",
			},
			{
				q: "Will this work for large classes?",
				a: "Yes. The techniques are designed to scale from 10 to 100+ learners.",
			},
		],
	},
	{
		slug: "classroom-management-foundations",
		title: "Classroom Management Foundations",
		summary:
			"Build a calm, focused classroom culture with routines and relationships that stick.",
		category: "classroom",
		level: "beginner",
		durationHours: 5,
		lessonCount: 22,
		rating: 4.8,
		enrolled: 3580,
		priceNgn: 12000,
		isEarnBack: true,
		instructorName: "Samuel Adeyemi",
		instructorTitle: "Veteran educator",
		outcomes: [
			"Establish routines that prevent disruption",
			"De-escalate conflict with confidence",
			"Build trust that makes learning possible",
		],
		modules: [
			{
				title: "The first two weeks",
				lessons: [
					{ title: "Setting routines", minutes: 13 },
					{ title: "Co-creating norms", minutes: 10 },
				],
			},
			{
				title: "When things go wrong",
				lessons: [
					{ title: "Calm responses", minutes: 12 },
					{ title: "Restorative conversations", minutes: 15 },
				],
			},
		],
		faqs: [
			{
				q: "Is this suitable for new teachers?",
				a: "Absolutely — it's built for your first years in the classroom.",
			},
		],
	},
	{
		slug: "assessment-that-drives-growth",
		title: "Assessment That Drives Growth",
		summary:
			"Move beyond grades to feedback that actually changes how students learn.",
		category: "assessment",
		level: "intermediate",
		durationHours: 6,
		lessonCount: 24,
		rating: 4.7,
		enrolled: 1620,
		priceNgn: 15000,
		isEarnBack: true,
		instructorName: "Aisha Bello",
		instructorTitle: "Assessment lead",
		outcomes: [
			"Write rubrics students understand",
			"Give feedback that motivates, not deflates",
			"Use formative data to adapt your teaching",
		],
		modules: [
			{
				title: "Feedback foundations",
				lessons: [
					{ title: "Growth-framed feedback", minutes: 11 },
					{ title: "Rubrics that work", minutes: 13 },
				],
			},
		],
		faqs: [
			{
				q: "Does this cover digital assessment?",
				a: "Yes, including quizzes, projects, and peer review.",
			},
		],
	},
	{
		slug: "edtech-tools-that-matter",
		title: "EdTech Tools That Actually Matter",
		summary:
			"Cut through the noise and adopt a small set of tools that genuinely improve learning.",
		category: "edtech",
		level: "intermediate",
		durationHours: 3.5,
		lessonCount: 14,
		rating: 4.6,
		enrolled: 980,
		priceNgn: 0,
		isEarnBack: false,
		instructorName: "Tobi Okonkwo",
		instructorTitle: "EdTech specialist",
		outcomes: [
			"Choose tools by learning impact, not hype",
			"Blend digital and offline activities",
			"Protect student focus and data",
		],
		modules: [
			{
				title: "A lean toolkit",
				lessons: [
					{ title: "The 5-tool rule", minutes: 8 },
					{ title: "Blended lesson design", minutes: 12 },
				],
			},
		],
		faqs: [
			{
				q: "Do I need fast internet?",
				a: "No — the course emphasises low-bandwidth, offline-friendly approaches.",
			},
		],
	},
	{
		slug: "teacher-leadership-essentials",
		title: "Teacher Leadership Essentials",
		summary:
			"Lead colleagues, mentor new teachers, and drive change from the classroom up.",
		category: "leadership",
		level: "advanced",
		durationHours: 7,
		lessonCount: 28,
		rating: 4.9,
		enrolled: 740,
		priceNgn: 20000,
		isEarnBack: true,
		instructorName: "Grace Nwosu",
		instructorTitle: "School leader",
		outcomes: [
			"Mentor new teachers effectively",
			"Lead professional development sessions",
			"Influence school-wide change",
		],
		modules: [
			{
				title: "Leading peers",
				lessons: [
					{ title: "Mentoring models", minutes: 14 },
					{ title: "Facilitating PD", minutes: 16 },
				],
			},
		],
		faqs: [
			{
				q: "Is a formal leadership role required?",
				a: "No — this is for any teacher ready to lead from where they are.",
			},
		],
	},
	{
		slug: "motivation-and-mindset",
		title: "Motivation & Growth Mindset",
		summary:
			"Spark intrinsic motivation and a growth mindset that helps every learner persist.",
		category: "pedagogy",
		level: "beginner",
		durationHours: 4,
		lessonCount: 16,
		rating: 4.8,
		enrolled: 2890,
		priceNgn: 0,
		isEarnBack: false,
		instructorName: "Dr. Ngozi Eze",
		instructorTitle: "Learning scientist",
		outcomes: [
			"Frame ability as something that grows",
			"Design tasks at the right desirable difficulty",
			"Build classroom rituals that celebrate effort",
		],
		modules: [
			{
				title: "Mindset in practice",
				lessons: [
					{ title: "Praise that builds grit", minutes: 10 },
					{ title: "Productive struggle", minutes: 12 },
				],
			},
		],
		faqs: [
			{
				q: "Is this based on research?",
				a: "Yes — it draws on Dweck, Deci & Ryan, and decades of motivation science.",
			},
		],
	},
];

export function getCourseBySlug(slug: string): SampleCourse | undefined {
	return SAMPLE_COURSES.find((course) => course.slug === slug);
}

export type PathLevel = CourseLevel | "mixed";

export interface SamplePath {
	slug: string;
	title: string;
	summary: string;
	level: PathLevel;
	courseSlugs: string[];
	estimatedHours: number;
	outcome: string;
	priceNgn: number;
	isEarnBack: boolean;
	enrolled: number;
}

export const SAMPLE_PATHS: SamplePath[] = [
	{
		slug: "become-a-master-teacher",
		title: "Become a Master Teacher",
		summary:
			"A guided journey from classroom fundamentals to confident, evidence-based teaching.",
		level: "mixed",
		courseSlugs: [
			"classroom-management-foundations",
			"active-recall-classroom",
			"assessment-that-drives-growth",
			"motivation-and-mindset",
		],
		estimatedHours: 18,
		outcome:
			"Run an engaging, well-managed classroom where students remember more and grow faster.",
		priceNgn: 30000,
		isEarnBack: true,
		enrolled: 1240,
	},
	{
		slug: "assessment-and-feedback-pro",
		title: "Assessment & Feedback Pro",
		summary:
			"Master modern assessment — from rubrics to feedback that changes how students learn.",
		level: "intermediate",
		courseSlugs: ["assessment-that-drives-growth", "active-recall-classroom"],
		estimatedHours: 10,
		outcome: "Design assessments and feedback that drive measurable growth.",
		priceNgn: 0,
		isEarnBack: false,
		enrolled: 860,
	},
	{
		slug: "teacher-leadership-track",
		title: "Teacher Leadership Track",
		summary: "Step up from great teacher to school-wide leader and mentor.",
		level: "advanced",
		courseSlugs: ["teacher-leadership-essentials", "motivation-and-mindset"],
		estimatedHours: 11,
		outcome:
			"Lead colleagues, mentor new teachers, and drive change from the classroom up.",
		priceNgn: 25000,
		isEarnBack: true,
		enrolled: 540,
	},
];

export function getPathBySlug(slug: string): SamplePath | undefined {
	return SAMPLE_PATHS.find((path) => path.slug === slug);
}

export interface SampleCohort {
	slug: string;
	title: string;
	summary: string;
	level: PathLevel;
	startsAt: string;
	weeks: number;
	capacity: number;
	seatsFilled: number;
	facilitatorName: string;
	priceNgn: number;
	isEarnBack: boolean;
	courseSlugs: string[];
	highlights: string[];
}

export const SAMPLE_COHORTS: SampleCohort[] = [
	{
		slug: "master-teacher-cohort-q3",
		title: "Master Teacher Cohort — Q3",
		summary:
			"A facilitated, 8-week cohort moving through the Master Teacher path together.",
		level: "mixed",
		startsAt: "2026-09-07",
		weeks: 8,
		capacity: 40,
		seatsFilled: 31,
		facilitatorName: "Samuel Adeyemi",
		priceNgn: 45000,
		isEarnBack: true,
		courseSlugs: [
			"classroom-management-foundations",
			"active-recall-classroom",
			"assessment-that-drives-growth",
		],
		highlights: [
			"Weekly live check-ins",
			"Peer learning groups",
			"Group projects with feedback",
			"Certificate on completion",
		],
	},
	{
		slug: "assessment-mastery-cohort",
		title: "Assessment Mastery Cohort",
		summary:
			"Six focused weeks to overhaul how you assess and give feedback, with a peer group.",
		level: "intermediate",
		startsAt: "2026-10-05",
		weeks: 6,
		capacity: 30,
		seatsFilled: 12,
		facilitatorName: "Aisha Bello",
		priceNgn: 28000,
		isEarnBack: true,
		courseSlugs: ["assessment-that-drives-growth"],
		highlights: [
			"Live feedback clinics",
			"Rubric workshops",
			"Peer review practice",
			"Certificate on completion",
		],
	},
	{
		slug: "new-teacher-bootcamp",
		title: "New Teacher Bootcamp",
		summary:
			"A supportive launchpad for your first years — routines, recall, and resilience.",
		level: "beginner",
		startsAt: "2026-08-24",
		weeks: 5,
		capacity: 50,
		seatsFilled: 47,
		facilitatorName: "Grace Nwosu",
		priceNgn: 0,
		isEarnBack: false,
		courseSlugs: ["classroom-management-foundations", "motivation-and-mindset"],
		highlights: [
			"Weekly mentor sessions",
			"Buddy system",
			"Ready-to-use templates",
			"Certificate on completion",
		],
	},
];

export function getCohortBySlug(slug: string): SampleCohort | undefined {
	return SAMPLE_COHORTS.find((cohort) => cohort.slug === slug);
}
