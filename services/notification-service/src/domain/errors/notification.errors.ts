export class TemplateNotFoundError extends Error {
  constructor(templateId: string) { super(`Template '${templateId}' not found`); this.name = 'TemplateNotFoundError'; }
}
export class ChannelUnavailableError extends Error {
  constructor(channel: string) { super(`Channel '${channel}' is unavailable`); this.name = 'ChannelUnavailableError'; }
}
export class DeliveryFailedError extends Error {
  constructor(notificationId: string, reason: string) { super(`Delivery failed for '${notificationId}': ${reason}`); this.name = 'DeliveryFailedError'; }
}
export class RateLimitExceededError extends Error {
  constructor(tenantId: string) { super(`Notification rate limit exceeded for tenant '${tenantId}'`); this.name = 'RateLimitExceededError'; }
}
