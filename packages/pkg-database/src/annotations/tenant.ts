export function Tenant() {
  return (target: any, propertyKey: string) => {
    target.constructor.__tenantField = propertyKey;
  };
}
