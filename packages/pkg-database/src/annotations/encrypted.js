"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Encrypted = Encrypted;
function Encrypted() {
    return (target, propertyKey) => {
        if (!target.constructor.__encryptedFields) {
            target.constructor.__encryptedFields = [];
        }
        target.constructor.__encryptedFields.push(propertyKey);
    };
}
//# sourceMappingURL=encrypted.js.map