"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEntityModel = void 0;
/**
 * Abstract base class that concrete entity classes can extend.
 * Provides sensible defaults for new instances.
 */
class BaseEntityModel {
    id;
    createdAt;
    updatedAt;
    tenantId;
}
exports.BaseEntityModel = BaseEntityModel;
//# sourceMappingURL=base.entity.js.map