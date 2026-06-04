/**
 * Base entity shape that all persistent domain entities should extend.
 * Provides standard audit columns and a tenant discriminator.
 */
export interface BaseEntity {
    /** Primary key – UUID v4. */
    id: string;
    /** ISO-8601 creation timestamp. */
    createdAt: Date;
    /** ISO-8601 last-update timestamp. */
    updatedAt: Date;
    /** Tenant discriminator for multi-tenant RLS. */
    tenantId: string;
}
/**
 * Abstract base class that concrete entity classes can extend.
 * Provides sensible defaults for new instances.
 */
export declare abstract class BaseEntityModel implements BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    tenantId: string;
}
//# sourceMappingURL=base.entity.d.ts.map