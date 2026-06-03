import { FeatureFlag } from '../../domain/entities.js';

export interface EvaluationContext {
  userId?: string;
  attributes?: Record<string, string>;
}

export class EvaluateFlagUseCase {
  /**
   * Consistently hashes a string into a number from 0-99.
   */
  private hashString(val: string): number {
    let hash = 0;
    for (let i = 0; i < val.length; i++) {
      hash = (hash << 5) - hash + val.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }

  execute(flag: FeatureFlag, context: EvaluationContext = {}): boolean {
    // 1. If flag is disabled globally, return false
    if (!flag.enabled) {
      return false;
    }

    // 2. Evaluate target rules if any exist
    if (flag.targetRules && flag.targetRules.length > 0) {
      for (const rule of flag.targetRules) {
        const userValue = context.attributes?.[rule.attribute];
        if (!userValue) {
          return false; // User lacks required attribute for rule
        }

        if (rule.operator === 'eq') {
          if (!rule.values.includes(userValue)) return false;
        } else if (rule.operator === 'in') {
          if (!rule.values.includes(userValue)) return false;
        }
      }
    }

    // 3. Evaluate strategy
    switch (flag.strategy) {
      case 'boolean':
        return true; // Enabled globally and passed target rules

      case 'percentage': {
        const idToHash = context.userId || 'anonymous-user';
        const score = this.hashString(flag.key + '-' + idToHash);
        const limit = flag.rolloutPercentage ?? 0;
        return score < limit;
      }

      case 'gradual': {
        // Similar to percentage, but fallback to 0 if not provided
        const idToHash = context.userId || 'anonymous-user';
        const score = this.hashString(flag.key + '-gradual-' + idToHash);
        const limit = flag.rolloutPercentage ?? 0;
        return score < limit;
      }

      default:
        return false;
    }
  }
}
