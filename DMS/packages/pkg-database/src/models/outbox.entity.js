"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxEntryModel = void 0;
class OutboxEntryModel {
    id;
    aggregateType;
    aggregateId;
    eventType;
    payload;
    createdAt;
    publishedAt = null;
}
exports.OutboxEntryModel = OutboxEntryModel;
//# sourceMappingURL=outbox.entity.js.map