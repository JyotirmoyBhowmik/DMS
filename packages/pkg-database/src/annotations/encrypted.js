"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Encrypted = Encrypted;
exports.isEncrypted = isEncrypted;
exports.getEncryptedFields = getEncryptedFields;
exports.packEncrypted = packEncrypted;
exports.unpackEncrypted = unpackEncrypted;
exports.createEncryptedTransformer = createEncryptedTransformer;
require("reflect-metadata");
const crypto_1 = require("crypto");
const ENCRYPTED_METADATA_KEY = 'dms:encrypted';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
/**
 * Marks a property for automatic encryption on write and decryption on read.
 * The ORM transformer uses AesGcmCipher-compatible pack/unpack format.
 */
function Encrypted() {
    return (target, propertyKey) => {
        Reflect.defineMetadata(ENCRYPTED_METADATA_KEY, true, target, propertyKey);
        const ctor = target.constructor;
        if (!ctor.__encryptedFields) {
            ctor.__encryptedFields = [];
        }
        const key = String(propertyKey);
        if (!ctor.__encryptedFields.includes(key)) {
            ctor.__encryptedFields.push(key);
        }
    };
}
/**
 * Returns true if the given property is marked for encryption.
 */
function isEncrypted(target, propertyKey) {
    return Reflect.getMetadata(ENCRYPTED_METADATA_KEY, target, propertyKey) === true;
}
/**
 * Returns the list of encrypted field names registered on a constructor.
 */
function getEncryptedFields(ctor) {
    return ctor.__encryptedFields ?? [];
}
// ── AesGcm-compatible pack/unpack ──────────────────────────────
/**
 * Packs a plaintext string into a single base64 blob containing
 * iv + authTag + ciphertext.  This is interoperable with the
 * AesGcmCipher.pack format used elsewhere in the monorepo.
 */
function packEncrypted(plaintext, keyHex) {
    const key = Buffer.from(keyHex, 'hex');
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: base64(iv + tag + ciphertext)
    const packed = Buffer.concat([iv, tag, encrypted]);
    return packed.toString('base64');
}
/**
 * Unpacks and decrypts a base64 blob produced by `packEncrypted`.
 */
function unpackEncrypted(packed, keyHex) {
    const key = Buffer.from(keyHex, 'hex');
    const buf = Buffer.from(packed, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = buf.subarray(IV_LENGTH + 16);
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
}
/**
 * Creates a TypeORM-compatible value transformer for automatic
 * encrypt-on-write / decrypt-on-read of column values.
 */
function createEncryptedTransformer(keyHex) {
    return {
        to(value) {
            if (value === null || value === undefined)
                return null;
            return packEncrypted(value, keyHex);
        },
        from(value) {
            if (value === null || value === undefined)
                return null;
            return unpackEncrypted(value, keyHex);
        },
    };
}
//# sourceMappingURL=encrypted.js.map