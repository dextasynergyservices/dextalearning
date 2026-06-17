import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

/**
 * Validates that a property matches another property on the same object.
 * Used for server-side confirm-password matching (blueprint §5.5).
 */
export function Match(property: string, options?: ValidationOptions) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: "Match",
			target: object.constructor,
			propertyName,
			constraints: [property],
			options,
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					const [relatedProperty] = args.constraints as [string];
					const relatedValue = (args.object as Record<string, unknown>)[
						relatedProperty
					];
					return value === relatedValue;
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} must match ${args.constraints[0]}`;
				},
			},
		});
	};
}
