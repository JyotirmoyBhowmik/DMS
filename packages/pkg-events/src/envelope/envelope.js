"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudEventBuilder = void 0;
const crypto_1 = require("crypto");
class CloudEventBuilder {
    static build({ source, type, subject, data, correlationId, tenantId, }) {
        return {
            id: (0, crypto_1.randomUUID)(),
            source,
            specversion: '1.0',
            type,
            datacontenttype: 'application/json',
            subject,
            time: new Date().toISOString(),
            data,
            correlationId,
            tenantId,
        };
    }
}
exports.CloudEventBuilder = CloudEventBuilder;
//# sourceMappingURL=envelope.js.map