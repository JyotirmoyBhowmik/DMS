"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonEventCodec = void 0;
class JsonEventCodec {
    static encode(envelope) {
        return JSON.stringify(envelope);
    }
    static decode(rawJson) {
        const parsed = JSON.parse(rawJson);
        if (!parsed.id || !parsed.source || !parsed.type || !parsed.time) {
            throw new Error('Invalid CloudEvent structure');
        }
        return parsed;
    }
}
exports.JsonEventCodec = JsonEventCodec;
//# sourceMappingURL=json.js.map