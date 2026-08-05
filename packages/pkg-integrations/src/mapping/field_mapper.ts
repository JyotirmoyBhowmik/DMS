export type CanonicalEntity = 'Product' | 'Customer' | 'Invoice';

export interface FieldMappingRule {
  canonicalField: string;
  erpField: string;
  transform?: 'trim' | 'uppercase' | 'lowercase' | 'parseCents' | 'parseDate';
}

export interface FieldMappingConfig {
  entityType: CanonicalEntity;
  rules: FieldMappingRule[];
}

export class FieldMapperEngine {
  /**
   * Maps an array of raw ERP JSON/XML records to canonical DMS format.
   */
  static mapRecords(records: any[], config: FieldMappingConfig): Record<string, any>[] {
    return records.map((raw) => this.mapSingleRecord(raw, config.rules));
  }

  /**
   * Maps a single raw ERP record according to rule mappings.
   */
  static mapSingleRecord(raw: any, rules: FieldMappingRule[]): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const rule of rules) {
      let rawValue = raw[rule.erpField];

      if (rawValue !== undefined && rawValue !== null) {
        if (rule.transform === 'trim' && typeof rawValue === 'string') {
          rawValue = rawValue.trim();
        } else if (rule.transform === 'uppercase' && typeof rawValue === 'string') {
          rawValue = rawValue.toUpperCase();
        } else if (rule.transform === 'lowercase' && typeof rawValue === 'string') {
          rawValue = rawValue.toLowerCase();
        } else if (rule.transform === 'parseCents') {
          rawValue = Math.round(parseFloat(String(rawValue)) * 100);
        } else if (rule.transform === 'parseDate') {
          rawValue = new Date(rawValue).toISOString();
        }
      }

      mapped[rule.canonicalField] = rawValue;
    }

    return mapped;
  }
}
