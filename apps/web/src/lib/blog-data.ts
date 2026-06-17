// Illustrative blog content (stands in for the CMS/API). Post bodies stay in
// English as sample data; page chrome is localized.

export interface BlogPost {
	slug: string;
	title: string;
	excerpt: string;
	category: string;
	author: string;
	date: string;
	readMinutes: number;
	gradient: string;
	body: string[];
}

export const SAMPLE_POSTS: BlogPost[] = [
	{
		slug: "why-re-reading-fails",
		title: "Why re-reading fails (and what to do instead)",
		excerpt:
			"Re-reading feels productive, but it barely moves memory. Retrieval practice does the heavy lifting — here's how to use it.",
		category: "Learning science",
		author: "Dr. Ngozi Eze",
		date: "2026-05-28",
		readMinutes: 6,
		gradient: "from-blue-600 to-indigo-800",
		body: [
			"When students re-read their notes, the material feels familiar — and that familiarity tricks us into thinking we've learned it. We haven't. Recognition is not recall.",
			"Retrieval practice flips this. By trying to pull information out of memory — through a quick quiz, a brain dump, or an exit ticket — you strengthen the pathway that lets you retrieve it again later.",
			"The discomfort of struggling to remember is the signal that learning is happening. Build small retrieval moments into every lesson and watch retention climb.",
		],
	},
	{
		slug: "earn-back-commitment-devices",
		title: "The psychology behind Earn-Back",
		excerpt:
			"A deadline you set yourself, with money on the line, is one of the most powerful tools for finishing what you start.",
		category: "Behavior",
		author: "Aisha Bello",
		date: "2026-05-14",
		readMinutes: 5,
		gradient: "from-amber-500 to-orange-700",
		body: [
			"Commitment devices work because we're more motivated to avoid a loss than to chase an equivalent gain. Earn-Back puts that asymmetry to work for learners.",
			"By setting a personal deadline and committing real value, learners give their future self a reason to show up — even on the days motivation dips.",
			"The result isn't pressure for its own sake. It's a gentle, self-chosen nudge that turns good intentions into completed courses.",
		],
	},
	{
		slug: "micro-lessons-cognitive-load",
		title: "Why every lesson is 15 minutes or less",
		excerpt:
			"Cognitive load theory explains why shorter, focused lessons beat marathon videos — and why we cap ours at 15 minutes.",
		category: "Design",
		author: "Tobi Okonkwo",
		date: "2026-04-30",
		readMinutes: 4,
		gradient: "from-violet-600 to-purple-800",
		body: [
			"Working memory is small. When a lesson tries to do too much at once, most of it never makes it into long-term memory.",
			"Chunking content into focused, 15-minute micro-lessons respects those limits. Each lesson does one thing well, then gives the brain a chance to consolidate.",
			"Shorter lessons also fit real life — they slot into a commute, a break, or the quiet minutes after class.",
		],
	},
	{
		slug: "cohorts-make-learning-social",
		title: "Learning is a team sport",
		excerpt:
			"Social learning theory shows we learn from watching and working with others. Cohorts turn solo study into shared momentum.",
		category: "Community",
		author: "Grace Nwosu",
		date: "2026-04-16",
		readMinutes: 5,
		gradient: "from-emerald-600 to-teal-800",
		body: [
			"We're wired to learn socially — by observing, discussing, and being held accountable by people we respect.",
			"Cohorts and peer groups make progress visible and shared. A check-in from your group can do what no reminder notification ever could.",
			"When learning becomes a team sport, showing up stops being a chore and starts being something you do for the group.",
		],
	},
];

export function getPostBySlug(slug: string): BlogPost | undefined {
	return SAMPLE_POSTS.find((post) => post.slug === slug);
}
