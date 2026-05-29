export function PII() {
  return (target: any, propertyKey: string) => {
    if (!target.constructor.__piiFields) {
      target.constructor.__piiFields = [];
    }
    target.constructor.__piiFields.push(propertyKey);
  };
}
