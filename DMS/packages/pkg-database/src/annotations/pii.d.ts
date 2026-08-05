import 'reflect-metadata';
/**
 * Marks a property as containing Personally Identifiable Information.
 * When set, the ORM layer and log-redaction utilities will mask the
 * value in read queries and log output respectively.
 */
export declare function PII(): PropertyDecorator;
/**
 * Returns true if the given property on the target is marked as PII.
 */
export declare function isPII(target: object, propertyKey: string | symbol): boolean;
/**
 * Returns the list of PII field names registered on a constructor.
 */
export declare function getPIIFields(ctor: Function): string[];
//# sourceMappingURL=pii.d.ts.map