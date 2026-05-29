export function Encrypted() {
  return (target: any, propertyKey: string) => {
    if (!target.constructor.__encryptedFields) {
      target.constructor.__encryptedFields = [];
    }
    target.constructor.__encryptedFields.push(propertyKey);
  };
}
