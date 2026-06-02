import { EventEnvelope } from '../envelope/envelope.js';

function writeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let temp = value;
  while (temp >= 0x80) {
    bytes.push((temp & 0x7f) | 0x80);
    temp >>>= 7;
  }
  bytes.push(temp & 0x7f);
  return Buffer.from(bytes);
}

function readVarint(buffer: Buffer, offset: { value: number }): number {
  let result = 0;
  let shift = 0;
  while (true) {
    if (offset.value >= buffer.length) {
      throw new Error('Unexpected end of buffer reading varint');
    }
    const byte = buffer[offset.value++];
    result |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) {
      break;
    }
    shift += 7;
  }
  return result;
}

function writeString(val: string): Buffer {
  const strBuf = Buffer.from(val, 'utf8');
  return Buffer.concat([writeVarint(strBuf.length), strBuf]);
}

function readString(buffer: Buffer, offset: { value: number }): string {
  const len = readVarint(buffer, offset);
  if (offset.value + len > buffer.length) {
    throw new Error(`Buffer overflow reading Avro string of length ${len}`);
  }
  const str = buffer.subarray(offset.value, offset.value + len).toString('utf8');
  offset.value += len;
  return str;
}

export class AvroEventCodec {
  /**
   * Encode an EventEnvelope using Avro binary encoding.
   * Positional fields:
   * - eventId (string)
   * - type (string)
   * - version (string)
   * - occurredAt (string)
   * - tenantId (string)
   * - correlationId (string)
   * - causationId (union index: 0 = null, 1 = string)
   * - producer (string)
   * - partitionKey (string)
   * - payload (JSON serialized string)
   */
  static encode<T>(envelope: EventEnvelope<T>): Buffer {
    const parts: Buffer[] = [
      writeString(envelope.eventId),
      writeString(envelope.type),
      writeString(envelope.version),
      writeString(envelope.occurredAt),
      writeString(envelope.tenantId),
      writeString(envelope.correlationId),
    ];

    if (envelope.causationId) {
      parts.push(writeVarint(1));
      parts.push(writeString(envelope.causationId));
    } else {
      parts.push(writeVarint(0));
    }

    parts.push(
      writeString(envelope.producer),
      writeString(envelope.partitionKey),
      writeString(JSON.stringify(envelope.payload))
    );

    return Buffer.concat(parts);
  }

  /**
   * Decode an EventEnvelope from Avro binary bytes.
   */
  static decode<T = any>(buffer: Buffer): EventEnvelope<T> {
    const offset = { value: 0 };

    const eventId = readString(buffer, offset);
    const type = readString(buffer, offset);
    const version = readString(buffer, offset);
    const occurredAt = readString(buffer, offset);
    const tenantId = readString(buffer, offset);
    const correlationId = readString(buffer, offset);

    const causationUnionIndex = readVarint(buffer, offset);
    let causationId: string | undefined;
    if (causationUnionIndex === 1) {
      causationId = readString(buffer, offset);
    } else if (causationUnionIndex !== 0) {
      throw new Error(`Invalid union index for causationId: ${causationUnionIndex}`);
    }

    const producer = readString(buffer, offset);
    const partitionKey = readString(buffer, offset);
    const payloadStr = readString(buffer, offset);
    const payload = JSON.parse(payloadStr);

    return {
      eventId,
      type,
      version,
      occurredAt,
      tenantId,
      correlationId,
      causationId,
      producer,
      partitionKey,
      payload,
    };
  }
}
