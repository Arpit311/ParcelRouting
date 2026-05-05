const RoutingEngine = require('../src/services/RoutingEngine');

describe('RoutingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new RoutingEngine();
  });

  describe('Single Parcel Routing', () => {
    test('should route light parcel (≤1kg) to Mail Department', () => {
      const parcel = { weight: 0.5, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Mail');
      expect(result.requiresApproval).toBe(false);
    });

    test('should route medium parcel (1-10kg) to Regular Department', () => {
      const parcel = { weight: 5, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Regular');
      expect(result.requiresApproval).toBe(false);
    });

    test('should route heavy parcel (>10kg) to Heavy Department', () => {
      const parcel = { weight: 15, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Heavy');
      expect(result.requiresApproval).toBe(false);
    });

    test('should route high-value parcel (>€1000) to Insurance', () => {
      const parcel = { weight: 0.5, value: 1500 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Insurance');
      expect(result.requiresApproval).toBe(true);
    });

    test('should prioritize insurance rule over weight rules', () => {
      const parcel = { weight: 15, value: 2000 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Insurance');
      expect(result.appliedRule).toBe('insurance-required');
    });

    test('should handle edge case at 1kg boundary', () => {
      const parcel = { weight: 1, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Mail');
    });

    test('should handle edge case at 10kg boundary', () => {
      const parcel = { weight: 10, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Regular');
    });

    test('should handle edge case at €1000 boundary', () => {
      const parcel = { weight: 5, value: 1000 };
      const result = engine.routeParcel(parcel);

      // €1000 exactly should NOT trigger insurance (> 1000, not ≥)
      expect(result.success).toBe(true);
      expect(result.department).toBe('Regular');
    });

    test('should reject invalid parcel (missing weight)', () => {
      const parcel = { value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
      expect(result.error).toContain('weight');
    });

    test('should reject negative weight', () => {
      const parcel = { weight: -5, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
    });

    test('should reject negative value', () => {
      const parcel = { weight: 5, value: -100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
    });

    test('should reject weight exceeding maximum', () => {
      const parcel = { weight: 1001, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
    });

    test('should reject value exceeding maximum', () => {
      const parcel = { weight: 5, value: 1000001 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
    });

    test('should reject non-object parcel', () => {
      const result = engine.routeParcel('not an object');
      expect(result.success).toBe(false);
    });

    test('should reject null parcel', () => {
      const result = engine.routeParcel(null);
      expect(result.success).toBe(false);
    });
  });

  describe('Batch Routing', () => {
    test('should route multiple parcels correctly', () => {
      const parcels = [
        { weight: 0.5, value: 100 },
        { weight: 5, value: 100 },
        { weight: 15, value: 100 },
      ];

      const result = engine.routeBatch(parcels);

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.parcels).toHaveLength(3);
    });

    test('should count department distribution correctly', () => {
      const parcels = [
        { weight: 0.5, value: 100 }, // Mail
        { weight: 0.3, value: 100 }, // Mail
        { weight: 5, value: 100 },   // Regular
        { weight: 15, value: 100 },  // Heavy
      ];

      const result = engine.routeBatch(parcels);

      expect(result.departmentCounts.Mail).toBe(2);
      expect(result.departmentCounts.Regular).toBe(1);
      expect(result.departmentCounts.Heavy).toBe(1);
    });

    test('should handle mixed valid and invalid parcels', () => {
      const parcels = [
        { weight: 5, value: 100 },        // Valid
        { weight: -5, value: 100 },       // Invalid
        { weight: 15, value: 100 },       // Valid
      ];

      const result = engine.routeBatch(parcels);

      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    test('should reject non-array input', () => {
      const result = engine.routeBatch('not an array');
      expect(result.success).toBe(false);
    });

    test('should process large batch correctly', () => {
      const parcels = Array(1000).fill(null).map((_, i) => ({
        weight: (i % 20) + 1, // Vary weights from 1-20
        value: (i % 500) + 1,
      }));

      const result = engine.routeBatch(parcels);

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(1000);
      expect(result.successCount).toBe(1000);
      expect(result.processingTimeMs).toBeDefined();
    });

    test('should return processing time in batch result', () => {
      const parcels = [
        { weight: 5, value: 100 },
        { weight: 10, value: 100 },
      ];

      const result = engine.routeBatch(parcels);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Validation', () => {
    test('should validate parcel weight is number', () => {
      const parcel = { weight: 'five', value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
    });

    test('should validate parcel value is number', () => {
      const parcel = { weight: 5, value: 'hundred' };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(false);
    });

    test('should handle parcels with additional fields', () => {
      const parcel = {
        weight: 5,
        value: 100,
        destinationCountry: 'NL',
        recipientName: 'John Doe',
      };

      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Regular');
    });
  });

  describe('Rules Management', () => {
    test('should return available rules', () => {
      const rules = engine.getAvailableRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('name');
      expect(rules[0]).toHaveProperty('priority');
    });

    test('should have rules in priority order', () => {
      const rules = engine.getAvailableRules();

      for (let i = 1; i < rules.length; i += 1) {
        expect(rules[i].priority).toBeGreaterThanOrEqual(rules[i - 1].priority);
      }
    });
  });

  describe('Regression Tests', () => {
    test('should not route parcel to wrong department based on incorrect logic', () => {
      // This test ensures a common bug is caught:
      // Incorrectly routing based on OR instead of AND logic
      const parcel = { weight: 5, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.department).not.toBe('Mail'); // Mail is only for ≤1kg
      expect(result.department).not.toBe('Heavy'); // Heavy is only for >10kg
      expect(result.department).toBe('Regular');
    });

    test('should apply highest priority rule first', () => {
      // Ensure insurance rule is checked before weight rules
      const parcel = { weight: 0.5, value: 2000 };
      const result = engine.routeParcel(parcel);

      expect(result.department).toBe('Insurance');
      expect(result.appliedRule).toBe('insurance-required');
    });

    test('should handle zero weight parcel', () => {
      const parcel = { weight: 0, value: 100 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Mail');
    });

    test('should handle zero value parcel', () => {
      const parcel = { weight: 5, value: 0 };
      const result = engine.routeParcel(parcel);

      expect(result.success).toBe(true);
      expect(result.department).toBe('Regular');
      expect(result.requiresApproval).toBe(false);
    });
  });
});
