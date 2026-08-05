"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginSchema = void 0;
const zod_1 = require("zod");
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address format'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long'),
    deviceId: zod_1.z.string().min(1, 'Device identifier is required'),
});
//# sourceMappingURL=auth.schema.js.map