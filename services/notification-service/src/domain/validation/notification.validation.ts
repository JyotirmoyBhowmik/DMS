import { CreateNotificationDto, UpdateNotificationDto } from '../../application/dtos/notification.dto.js';
import { NotificationChannel } from '../entities/notification.entity.js';

export function validateCreateNotificationInput(dto: CreateNotificationDto): void {
  if (!dto) {
    throw new Error('Notification input payload is required.');
  }
  if (!dto.recipient || dto.recipient.trim().length === 0) {
    throw new Error('Notification recipient is required.');
  }
  const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
  if (!dto.channel || !validChannels.includes(dto.channel)) {
    throw new Error(`Invalid notification channel: ${dto.channel}`);
  }
  if (dto.channel === 'EMAIL') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.recipient)) {
      throw new Error(`Invalid email address format for recipient: ${dto.recipient}`);
    }
  }
  if (dto.payload !== undefined && (typeof dto.payload !== 'object' || dto.payload === null)) {
    throw new Error('Notification payload must be an object.');
  }
}

export function validateUpdateNotificationInput(dto: UpdateNotificationDto): void {
  if (!dto) {
    throw new Error('Notification update payload is required.');
  }
  if (typeof dto.version !== 'number' || dto.version < 1) {
    throw new Error('Version must be a positive integer.');
  }
  if (dto.payload !== undefined && (typeof dto.payload !== 'object' || dto.payload === null)) {
    throw new Error('Notification payload must be an object.');
  }
}
