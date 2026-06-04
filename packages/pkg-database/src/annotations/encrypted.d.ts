import 'reflect-metadata';
/**
 * Marks a property for automatic encryption on write and decryption on read.
 * The ORM transformer uses AesGcmCipher-compatible pack/unpack format.
 */
export declare function Encrypted(): PropertyDecorator;
/**
 * Returns true if the given property is marked for encryption.
 */
export declare function isEncrypted(target: object, propertyKey: string | symbol): boolean;
/**
 * Returns the list of encrypted field names registered on a constructor.
 */
export declare function getEncryptedFields(ctor: Function): string[];
/**
 * Packs a plaintext string into a single base64 blob containing
 * iv + authTag + ciphertext.  This is interoperable with the
 * AesGcmCipher.pack format used elsewhere in the monorepo.
 */
export declare function packEncrypted(plaintext: string, keyHex: string): string;
/**
 * Unpacks and decrypts a base64 blob produced by `packEncrypted`.
 */
export declare function unpackEncrypted(packed: string, keyHex: string): string;
/**
 * Creates a TypeORM-compatible value transformer for automatic
 * encrypt-on-write / decrypt-on-read of column values.
 */
export declare function createEncryptedTransformer(keyHex: string): {
    to(value: string | null | undefined): string | null;
    from(value: string | null | undefined): string | null;
};
//# sourceMappingURL=encrypted.d.ts.map