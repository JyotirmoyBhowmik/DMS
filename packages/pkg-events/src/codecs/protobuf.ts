import { EventEnvelope } from '../envelope/envelope.js';

// Protobuf wire types
// 0: Varint (int32, int64, etc.)
// 2: Length-delimited (string, bytes, embedded messages)
const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_LENGTH_DELIMITED = 2;

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

function writeString(fieldNumber: number, val: string): Buffer {
  const strBuf = Buffer.from(val, 'utf8');
  const tag = (fieldNumber << 3) | WIRE_TYPE_LENGTH_DELIMITED;
  return Buffer.concat([
    writeVarint(tag),
    writeVarint(strBuf.length),
    strBuf,
  ]);
}

export class ProtobufEventCodec {
  /**
   * Encode an EventEnvelope into binary protobuf format.
   * Field mappings:
   * 1: eventId (string)
   * 2: type (string)
   * 3: version (string)
   * 4: occurredAt (string)
   * 5: tenantId (string)
   * 6: correlationId (string)
   * 7: causationId (string, optional)
   * 8: producer (string)
   * 9: partitionKey (string)
   * 10: payload (JSON string representation of type T)
   */
  static encode<T>(envelope: EventEnvelope<T>): Buffer {
    const buffers: Buffer[] = [
      writeString(1, envelope.eventId),
      writeString(2, envelope.type),
      writeString(3, envelope.version),
      writeString(4, envelope.occurredAt),
      writeString(5, envelope.tenantId),
      writeString(6, envelope.correlationId),
    ];

    if (envelope.causationId) {
      buffers.push(writeString(7, envelope.causationId));
    }

    buffers.push(
      writeString(8, envelope.producer),
      writeString(9, envelope.partitionKey),
      writeString(10, JSON.stringify(envelope.payload))
    );

    return Buffer.concat(buffers);
  }

  /**
   * Decode binary protobuf bytes back to EventEnvelope.
   */
  static decode<T = any>(buffer: Buffer): EventEnvelope<T> {
    const offset = { value: 0 };
    const fields: Partial<EventEnvelope<any>> = {};
    let payloadStr = '';

    while (offset.value < buffer.length) {
      const tag = readVarint(buffer, offset);
      const fieldNumber = tag >>> 3;
      const wireType = tag & 0x07;

      if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
        const len = readVarint(buffer, offset);
        if (offset.value + len > buffer.length) {
          throw new Error(`Buffer overflow: tried to read ${len} bytes at offset ${offset.value}`);
        }
        const data = buffer.subarray(offset.value, offset.value + len);
        offset.value += len;

        const strVal = data.toString('utf8');

        switch (fieldNumber) {
          case 1:
            fields.eventId = strVal;
            break;
          case 2:
            fields.type = strVal;
            break;
          case 3:
            fields.version = strVal;
            break;
          case 4:
            fields.occurredAt = strVal;
            break;
          case 5:
            fields.tenantId = strVal;
            break;
          case 6:
            fields.correlationId = strVal;
            break;
          case 7:
            fields.causationId = strVal;
            break;
          case 8:
            fields.producer = strVal;
            break;
          case 9:
            fields.partitionKey = strVal;
            break;
          case 10:
            payloadStr = strVal;
            break;
          default:
            // Unknown field, skip
            break;
        }
      } else if (wireType === WIRE_TYPE_VARINT) {
        // Just consume the varint to skip unknown fields
        readVarint(buffer, offset);
      } else {
        throw new Error(`Unsupported wire type: ${wireType} at offset ${offset.value}`);
      }
    }

    // Verify required fields
    if (
      !fields.eventId ||
      !fields.type ||
      !fields.version ||
      !fields.occurredAt ||
      !fields.tenantId ||
      !fields.correlationId ||
      !fields.producer ||
      !fields.partitionKey ||
      !payloadStr
    ) {
      throw new Error('Missing required fields in decoded protobuf message');
    }

    fields.payload = JSON.parse(payloadStr);
    return fields as EventEnvelope<T>;
  }
}
