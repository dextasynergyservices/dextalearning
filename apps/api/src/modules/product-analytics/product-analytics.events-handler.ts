import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	ANALYTICS_PORT,
	type AnalyticsPort,
} from "../../shared/analytics/analytics.port";
import {
	type AttemptSubmittedEvent,
	type EnrollmentCreatedEvent,
	type EntityCompletedEvent,
	LearningEvents,
	type LessonCompletedEvent,
	type ProjectGradedEvent,
} from "../../shared/events/learning-events";
import {
	type EarnBackProcessedEvent,
	type PaymentConfirmedEvent,
	PaymentEvents,
} from "../../shared/events/payment-events";

/**
 * Product analytics context (§15). Passes the §6.4 litmus test literally: it
 * consumes only PUBLISHED domain events and speaks only through the analytics
 * port — extract it into its own service and nothing but its subscriptions
 * move. It never joins back into any emitter's tables (§6.4 rule 5): what the
 * event payload carries is what PostHog gets.
 *
 * Event names are the product funnel's vocabulary, snake_case, past tense —
 * they must stay stable once dashboards are built on them, so treat renames
 * like API breaking changes.
 */
@Injectable()
export class ProductAnalyticsEventsHandler {
	constructor(
		@Inject(ANALYTICS_PORT) private readonly analytics: AnalyticsPort,
	) {}

	@OnEvent(LearningEvents.EnrollmentCreated)
	onEnrollment(event: EnrollmentCreatedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "enrollment_created",
			properties: {
				entity_type: event.entityType,
				entity_id: event.entityId,
			},
		});
	}

	@OnEvent(LearningEvents.LessonCompleted)
	onLessonCompleted(event: LessonCompletedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "lesson_completed",
			properties: { course_id: event.courseId, lesson_id: event.lessonId },
		});
	}

	@OnEvent(LearningEvents.AttemptSubmitted)
	onAttemptSubmitted(event: AttemptSubmittedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "assessment_submitted",
			properties: {
				assessment_id: event.assessmentId,
				scope: event.scope,
				score: event.score,
				passed: event.passed,
				attempt_number: event.attemptNumber,
			},
		});
	}

	@OnEvent(LearningEvents.ProjectGraded)
	onProjectGraded(event: ProjectGradedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "project_graded",
			properties: { project_id: event.projectId, passed: event.passed },
		});
	}

	@OnEvent(LearningEvents.EntityCompleted)
	onEntityCompleted(event: EntityCompletedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "content_completed",
			properties: {
				entity_type: event.entityType,
				entity_id: event.entityId,
			},
		});
	}

	@OnEvent(PaymentEvents.PaymentConfirmed)
	onPaymentConfirmed(event: PaymentConfirmedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "order_settled",
			properties: {
				order_id: event.orderId,
				entity_type: event.entityType,
				entity_id: event.entityId,
				// Deliberately no amount: money analytics reads the settled orders
				// read-model (§14.1.1), not an at-most-once event stream — the two
				// would inevitably disagree and the ledger must win.
			},
		});
	}

	@OnEvent(PaymentEvents.EarnBackProcessed)
	onEarnBackProcessed(event: EarnBackProcessedEvent): void {
		this.analytics.capture({
			distinctId: event.userId,
			event: "earn_back_refunded",
			properties: { days_late: event.daysLate },
		});
	}
}
