import 'reflect-metadata';

const PII_METADATA_KEY = 'dms:pii';

/**
 * Marks a property as containing Personally Identifiable Information.
 * When set, the ORM layer and log-redaction utilities will mask the
 * value in read queries and log output respectively.
 */
export function PII(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(PII_METADATA_KEY, true, target, propertyKey);

    // Also maintain a registry of PII fields on the constructor for
    // bulk introspection (e.g. building SELECT masks).
    const ctor = target.constructor as { __piiFields?: string[] };
    if (!ctor.__piiFields) {
      ctor.__piiFields = [];
    }
    const key = String(propertyKey);
    if (!ctor.__piiFields.includes(key)) {
      ctor.__piiFields.push(key);
    }
  };
}

/**
 * Returns true if the given property on the target is marked as PII.
 */
export function isPII(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(PII_METADATA_KEY, target, propertyKey) === true;
}

/**
 * Returns the list of PII field names registered on a constructor.
 */
export function getPIIFields(ctor: Function): string[] {
  return (ctor as { __piiFields?: string[] }).__piiFields ?? [];
}
