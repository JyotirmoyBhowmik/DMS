"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PII = PII;
function PII() {
    return (target, propertyKey) => {
        if (!target.constructor.__piiFields) {
            target.constructor.__piiFields = [];
        }
        target.constructor.__piiFields.push(propertyKey);
    };
}
//# sourceMappingURL=pii.js.map