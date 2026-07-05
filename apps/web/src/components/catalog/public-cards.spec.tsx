// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	PublishedCohort,
	PublishedCourse,
	PublishedPath,
} from "@/lib/content-api";
import { renderWithRouter } from "@/test/render";
import {
	PublicCohortCard,
	PublicCourseCard,
	PublicPathCard,
} from "./public-cards";

const commercials = {
	thumbnailUrl: null,
	price: 5000,
	isFree: false,
	currency: "NGN",
	isEarnBackEligible: false,
	earnBackPercentage: null,
};

function course(overrides: Partial<PublishedCourse> = {}): PublishedCourse {
	return {
		id: "c1",
		title: "Intro to Testing",
		slug: "intro-to-testing",
		description: null,
		level: "beginner",
		language: "en",
		thumbnailKey: null,
		_count: { modules: 4 },
		...commercials,
		...overrides,
	};
}

function path(overrides: Partial<PublishedPath> = {}): PublishedPath {
	return {
		id: "p1",
		title: "Full Stack Path",
		slug: "full-stack-path",
		description: null,
		outcomeStatement: null,
		estimatedHours: null,
		estimatedDuration: null,
		level: null,
		thumbnailKey: null,
		_count: { pathCourses: 3 },
		...commercials,
		...overrides,
	} as PublishedPath;
}

function cohort(overrides: Partial<PublishedCohort> = {}): PublishedCohort {
	return {
		id: "co1",
		title: "Spring Cohort",
		slug: "spring-cohort",
		description: null,
		startsAt: null,
		endsAt: null,
		capacity: null,
		seatsFilled: 0,
		_count: { courses: 2 },
		...commercials,
		...overrides,
	} as PublishedCohort;
}

describe("PublicCourseCard", () => {
	it("shows the title, price and module count", async () => {
		renderWithRouter(<PublicCourseCard course={course()} />);
		expect(await screen.findByText("Intro to Testing")).toBeInTheDocument();
		expect(screen.getByText("4 modules")).toBeInTheDocument();
	});

	it("shows 'Free' instead of a price for free courses", async () => {
		renderWithRouter(<PublicCourseCard course={course({ isFree: true })} />);
		expect(await screen.findByText("Intro to Testing")).toBeInTheDocument();
		expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
	});
});

describe("PublicPathCard", () => {
	it("shows the title and course count", async () => {
		renderWithRouter(<PublicPathCard path={path()} />);
		expect(await screen.findByText("Full Stack Path")).toBeInTheDocument();
		expect(screen.getByText("3 courses")).toBeInTheDocument();
	});
});

describe("PublicCohortCard", () => {
	it("shows the title and seat count when capacity is set", async () => {
		renderWithRouter(
			<PublicCohortCard cohort={cohort({ capacity: 20, seatsFilled: 5 })} />,
		);
		expect(await screen.findByText("Spring Cohort")).toBeInTheDocument();
		expect(screen.getByText("5/20")).toBeInTheDocument();
	});

	it("omits the seat count when there's no capacity limit", async () => {
		renderWithRouter(<PublicCohortCard cohort={cohort({ capacity: null })} />);
		await screen.findByText("Spring Cohort");
		expect(screen.queryByText(/\/\d+$/)).not.toBeInTheDocument();
	});
});
