import { SchemeEntity, SchemeStatus, SchemeSlab, ComboItem } from '../entities/scheme.entity.js';

export interface OrderItemInput {
  skuId: string;
  quantity: number;
  price: number; // Unit price in Paire/cents
}

export interface SchemeEvaluationResult {
  schemeId: string;
  schemeName: string;
  isEligible: boolean;
  appliedDiscountPercentage: number;
  appliedFlatDiscount: number;
  appliedFreeGoods: { skuId: string; quantity: number }[];
  totalMonetaryBenefit: number;
  allowStacking: boolean;
  exclusionGroup: string;
}

export class SchemeAggregate {
  private scheme: SchemeEntity;

  constructor(scheme: SchemeEntity) {
    this.scheme = scheme;
  }

  getScheme(): SchemeEntity {
    return this.scheme;
  }

  validateInvariants(): void {
    if (!this.scheme.name.trim()) {
      throw new Error('Scheme aggregate invariant failed: name must not be empty');
    }
    if (!this.scheme.tenantId) {
      throw new Error('Scheme aggregate invariant failed: tenantId is required');
    }
    if (this.scheme.endDate && this.scheme.startDate > this.scheme.endDate) {
      throw new Error('Scheme aggregate invariant failed: startDate must be before or equal to endDate');
    }

    // Validate top-level payouts
    if (this.scheme.payouts.discountPercentage !== undefined) {
      const pct = this.scheme.payouts.discountPercentage;
      if (pct < 0 || pct > 100) {
        throw new Error('Scheme aggregate invariant failed: discountPercentage must be between 0 and 100');
      }
    }
    if (this.scheme.payouts.flatDiscountAmount !== undefined) {
      if (this.scheme.payouts.flatDiscountAmount < 0) {
        throw new Error('Scheme aggregate invariant failed: flatDiscountAmount must be non-negative');
      }
    }
    if (this.scheme.payouts.freeGoods) {
      for (const fg of this.scheme.payouts.freeGoods) {
        if (!fg.skuId) {
          throw new Error('Scheme aggregate invariant failed: free good skuId is required');
        }
        if (fg.quantity <= 0) {
          throw new Error('Scheme aggregate invariant failed: free good quantity must be positive');
        }
      }
    }

    // Validate slabs
    if (this.scheme.rules.slabs) {
      for (const slab of this.scheme.rules.slabs) {
        if (slab.minQuantity !== undefined && slab.minQuantity < 0) {
          throw new Error('Scheme aggregate invariant failed: slab minQuantity must be non-negative');
        }
        if (slab.minAmount !== undefined && slab.minAmount < 0) {
          throw new Error('Scheme aggregate invariant failed: slab minAmount must be non-negative');
        }
        if (slab.minQuantity === undefined && slab.minAmount === undefined) {
          throw new Error('Scheme aggregate invariant failed: slab must specify minQuantity or minAmount');
        }
        if (slab.discountPercentage !== undefined) {
          if (slab.discountPercentage < 0 || slab.discountPercentage > 100) {
            throw new Error('Scheme aggregate invariant failed: slab discountPercentage must be between 0 and 100');
          }
        }
        if (slab.flatDiscountAmount !== undefined && slab.flatDiscountAmount < 0) {
          throw new Error('Scheme aggregate invariant failed: slab flatDiscountAmount must be non-negative');
        }
        if (slab.freeGoods) {
          for (const fg of slab.freeGoods) {
            if (!fg.skuId) {
              throw new Error('Scheme aggregate invariant failed: slab free good skuId is required');
            }
            if (fg.quantity <= 0) {
              throw new Error('Scheme aggregate invariant failed: slab free good quantity must be positive');
            }
          }
        }
      }
    }

    // Validate comboItems
    if (this.scheme.rules.comboItems) {
      for (const item of this.scheme.rules.comboItems) {
        if (!item.skuId) {
          throw new Error('Scheme aggregate invariant failed: comboItem skuId is required');
        }
        if (item.minQty <= 0) {
          throw new Error('Scheme aggregate invariant failed: comboItem minQty must be positive');
        }
      }
    }
  }

  activate(): void {
    this.validateInvariants();
    if (this.scheme.status === 'expired') {
      throw new Error('Cannot activate an expired scheme');
    }
    this.scheme.status = 'active';
  }

  suspend(): void {
    if (this.scheme.status !== 'active') {
      throw new Error('Cannot suspend a scheme that is not active');
    }
    this.scheme.status = 'suspended';
  }

  expire(): void {
    this.scheme.status = 'expired';
  }

  /**
   * Evaluates if a given order matches this scheme's eligibility rules
   */
  isEligible(orderAmount: number, itemSkuIds: string[], evaluationDate = new Date()): boolean {
    if (this.scheme.status !== 'active') {
      return false;
    }
    if (evaluationDate < this.scheme.startDate) return false;
    if (this.scheme.endDate && evaluationDate > this.scheme.endDate) return false;

    // Check min order amount rule
    if (this.scheme.rules.minOrderAmount !== undefined) {
      if (orderAmount < this.scheme.rules.minOrderAmount) {
        return false;
      }
    }

    // Check applicable SKUs rule
    if (this.scheme.rules.applicableSkuIds && this.scheme.rules.applicableSkuIds.length > 0) {
      const hasMatchingSku = itemSkuIds.some(sku => 
        this.scheme.rules.applicableSkuIds!.includes(sku)
      );
      if (!hasMatchingSku) {
        return false;
      }
    }

    return true;
  }

  /**
   * Full evaluation of scheme rules and payouts against order items
   */
  evaluate(items: OrderItemInput[], evaluationDate = new Date()): SchemeEvaluationResult {
    const defaultResult: SchemeEvaluationResult = {
      schemeId: this.scheme.id,
      schemeName: this.scheme.name,
      isEligible: false,
      appliedDiscountPercentage: 0,
      appliedFlatDiscount: 0,
      appliedFreeGoods: [],
      totalMonetaryBenefit: 0,
      allowStacking: this.scheme.rules.allowStacking ?? false,
      exclusionGroup: this.scheme.rules.exclusionGroup || this.scheme.id,
    };

    if (this.scheme.status !== 'active') {
      return defaultResult;
    }
    if (evaluationDate < this.scheme.startDate) return defaultResult;
    if (this.scheme.endDate && evaluationDate > this.scheme.endDate) return defaultResult;

    // 1. Calculate order aggregates
    const totalOrderAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const itemSkuIds = items.map(item => item.skuId);

    // 2. Validate outer minOrderAmount
    if (this.scheme.rules.minOrderAmount !== undefined && totalOrderAmount < this.scheme.rules.minOrderAmount) {
      return defaultResult;
    }

    // 3. Validate outer applicableSkuIds
    if (this.scheme.rules.applicableSkuIds && this.scheme.rules.applicableSkuIds.length > 0) {
      const hasSku = items.some(item => this.scheme.rules.applicableSkuIds!.includes(item.skuId));
      if (!hasSku) {
        return defaultResult;
      }
    }

    // 4. Validate comboItems rule
    if (this.scheme.rules.comboItems && this.scheme.rules.comboItems.length > 0) {
      for (const comboItem of this.scheme.rules.comboItems) {
        const matchingItem = items.find(item => item.skuId === comboItem.skuId);
        if (!matchingItem || matchingItem.quantity < comboItem.minQty) {
          return defaultResult;
        }
      }
    }

    // 5. Select slab or top-level payout
    let appliedDiscountPercentage = 0;
    let appliedFlatDiscount = 0;
    let appliedFreeGoods: { skuId: string; quantity: number }[] = [];

    if (this.scheme.rules.slabs && this.scheme.rules.slabs.length > 0) {
      // Calculate matching items totals
      const matchingItems = this.scheme.rules.applicableSkuIds && this.scheme.rules.applicableSkuIds.length > 0
        ? items.filter(item => this.scheme.rules.applicableSkuIds!.includes(item.skuId))
        : items;

      const matchingQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      const matchingAmount = matchingItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

      // Find matching slab. Sort slabs descending by minAmount/minQuantity to pick the highest slab.
      const sortedSlabs = [...this.scheme.rules.slabs].sort((a, b) => {
        const valA = a.minAmount ?? 0;
        const valB = b.minAmount ?? 0;
        if (valA !== valB) return valB - valA;
        return (b.minQuantity ?? 0) - (a.minQuantity ?? 0);
      });

      let selectedSlab: SchemeSlab | null = null;
      for (const slab of sortedSlabs) {
        let isSlabMatch = true;
        if (slab.minQuantity !== undefined && matchingQuantity < slab.minQuantity) {
          isSlabMatch = false;
        }
        if (slab.minAmount !== undefined && matchingAmount < slab.minAmount) {
          isSlabMatch = false;
        }
        if (isSlabMatch) {
          selectedSlab = slab;
          break;
        }
      }

      // If slabs are specified and none match, the scheme is not eligible
      if (!selectedSlab) {
        return defaultResult;
      }

      appliedDiscountPercentage = selectedSlab.discountPercentage ?? 0;
      appliedFlatDiscount = selectedSlab.flatDiscountAmount ?? 0;
      appliedFreeGoods = selectedSlab.freeGoods ?? [];
    } else {
      appliedDiscountPercentage = this.scheme.payouts.discountPercentage ?? 0;
      appliedFlatDiscount = this.scheme.payouts.flatDiscountAmount ?? 0;
      appliedFreeGoods = this.scheme.payouts.freeGoods ?? [];
    }

    // 6. Compute total monetary benefit
    const matchingItemsValue = this.scheme.rules.applicableSkuIds && this.scheme.rules.applicableSkuIds.length > 0
      ? items.filter(item => this.scheme.rules.applicableSkuIds!.includes(item.skuId)).reduce((sum, item) => sum + item.quantity * item.price, 0)
      : totalOrderAmount;

    const discountFromPercentage = Math.round(matchingItemsValue * (appliedDiscountPercentage / 100));
    const totalDiscountVal = discountFromPercentage + appliedFlatDiscount;

    // Estimate free goods value based on order prices
    let freeGoodsValue = 0;
    for (const fg of appliedFreeGoods) {
      const orderItem = items.find(item => item.skuId === fg.skuId);
      if (orderItem) {
        freeGoodsValue += fg.quantity * orderItem.price;
      }
    }

    const totalMonetaryBenefit = totalDiscountVal + freeGoodsValue;

    return {
      schemeId: this.scheme.id,
      schemeName: this.scheme.name,
      isEligible: true,
      appliedDiscountPercentage,
      appliedFlatDiscount,
      appliedFreeGoods,
      totalMonetaryBenefit,
      allowStacking: this.scheme.rules.allowStacking ?? false,
      exclusionGroup: this.scheme.rules.exclusionGroup || this.scheme.id,
    };
  }
}
