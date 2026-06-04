"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PII = PII;
exports.isPII = isPII;
exports.getPIIFields = getPIIFields;
require("reflect-metadata");
const PII_METADATA_KEY = 'dms:pii';
/**
 * Marks a property as containing Personally Identifiable Information.
 * When set, the ORM layer and log-redaction utilities will mask the
 * value in read queries and log output respectively.
 */
function PII() {
    return (target, propertyKey) => {
        Reflect.defineMetadata(PII_METADATA_KEY, true, target, propertyKey);
        // Also maintain a registry of PII fields on the constructor for
        // bulk introspection (e.g. building SELECT masks).
        const ctor = target.constructor;
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
function isPII(target, propertyKey) {
    return Reflect.getMetadata(PII_METADATA_KEY, target, propertyKey) === true;
}
/**
 * Returns the list of PII field names registered on a constructor.
 */
function getPIIFields(ctor) {
    return ctor.__piiFields ?? [];
}
//# sourceMappingURL=pii.js.map