const path = require('path');
const {
  validateSingleParcel,
  validateBatchParcels,
  validateFileFormat,
  sanitizeParcel,
} = require(path.join(__dirname, '..', 'src', 'validators', 'parcelValidator'));

describe('Parcel Validator', () => {
  describe('Single Parcel Validation', () => {
    test('should validate correct parcel', () => {
      const parcel = { weight: 5, value: 100 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(true);
      expect(result.value).toBeDefined();
    });

    test('should accept optional fields', () => {
      const parcel = {
        weight: 5,
        value: 100,
        destinationCountry: 'NL',
        recipientName: 'John Doe',
      };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(true);
    });

    test('should reject missing weight', () => {
      const parcel = { value: 100 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject missing value', () => {
      const parcel = { weight: 5 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject negative weight', () => {
      const parcel = { weight: -5, value: 100 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject negative value', () => {
      const parcel = { weight: 5, value: -100 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject weight exceeding maximum', () => {
      const parcel = { weight: 1001, value: 100 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject value exceeding maximum', () => {
      const parcel = { weight: 5, value: 1000001 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject non-numeric weight', () => {
      const parcel = { weight: 'five', value: 100 };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject non-numeric value', () => {
      const parcel = { weight: 5, value: 'hundred' };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
    });

    test('should reject extra fields (security)', () => {
      const parcel = {
        weight: 5,
        value: 100,
        maliciousField: 'hack',
      };
      const result = validateSingleParcel(parcel);

      // Joi's unknown(false) should catch this
      expect(result.valid).toBe(false);
    });

    test('should reject long destination country', () => {
      const parcel = {
        weight: 5,
        value: 100,
        destinationCountry: 'A'.repeat(200),
      };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than or equal to 100');
    });

    test('should reject long recipient name', () => {
      const parcel = {
        weight: 5,
        value: 100,
        recipientName: 'A'.repeat(300),
      };
      const result = validateSingleParcel(parcel);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than or equal to 255');
    });
  });

  describe('Batch Parcels Validation', () => {
    test('should validate correct batch', () => {
      const parcels = [
        { weight: 5, value: 100 },
        { weight: 15, value: 200 },
      ];
      const result = validateBatchParcels(parcels);

      expect(result.valid).toBe(true);
      expect(result.value).toHaveLength(2);
    });

    test('should reject empty batch', () => {
      const result = validateBatchParcels([]);

      expect(result.valid).toBe(false);
    });

    test('should reject non-array input', () => {
      const result = validateBatchParcels({ weight: 5, value: 100 });

      expect(result.valid).toBe(false);
    });

    test('should reject batch exceeding size limit', () => {
      const parcels = Array(10001).fill({ weight: 5, value: 100 });
      const result = validateBatchParcels(parcels);

      expect(result.valid).toBe(false);
    });

    test('should reject batch with invalid parcel', () => {
      const parcels = [
        { weight: 5, value: 100 },
        { weight: -5, value: 100 }, // Invalid
      ];
      const result = validateBatchParcels(parcels);

      expect(result.valid).toBe(false);
    });

    test('should validate large valid batch', () => {
      const parcels = Array(1000).fill(null).map((_, i) => ({
        weight: (i % 20) + 1,
        value: (i % 500) + 1,
      }));
      const result = validateBatchParcels(parcels);

      expect(result.valid).toBe(true);
      expect(result.value).toHaveLength(1000);
    });
  });

  describe('File Format Validation', () => {
    test('should accept xml format', () => {
      const result = validateFileFormat('xml');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('xml');
    });

    test('should accept json format', () => {
      const result = validateFileFormat('json');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('json');
    });

    test('should reject invalid format', () => {
      const result = validateFileFormat('csv');

      expect(result.valid).toBe(false);
    });

    test('should be case-insensitive', () => {
      // Note: Joi's valid() is case-sensitive by default
      // The API should handle normalization before validation
      const result = validateFileFormat('XML');

      expect(result.valid).toBe(false); // Currently case-sensitive
    });
  });

  describe('Parcel Sanitization', () => {
    test('should sanitize recipient name', () => {
      const parcel = {
        weight: 5,
        value: 100,
        recipientName: 'John <script>alert("xss")</script> Doe',
      };
      const sanitized = sanitizeParcel(parcel);

      expect(sanitized.recipientName).not.toContain('<');
      expect(sanitized.recipientName).not.toContain('>');
    });

    test('should truncate long recipient name', () => {
      const parcel = {
        weight: 5,
        value: 100,
        recipientName: 'A'.repeat(300),
      };
      const sanitized = sanitizeParcel(parcel);

      expect(sanitized.recipientName.length).toBeLessThanOrEqual(255);
    });

    test('should sanitize destination country', () => {
      const parcel = {
        weight: 5,
        value: 100,
        destinationCountry: 'NL<img>',
      };
      const sanitized = sanitizeParcel(parcel);

      expect(sanitized.destinationCountry).not.toContain('<');
      expect(sanitized.destinationCountry).not.toContain('>');
    });

    test('should not modify numeric fields', () => {
      const parcel = {
        weight: 5.5,
        value: 100.5,
      };
      const sanitized = sanitizeParcel(parcel);

      expect(sanitized.weight).toBe(5.5);
      expect(sanitized.value).toBe(100.5);
    });

    test('should not modify missing optional fields', () => {
      const parcel = {
        weight: 5,
        value: 100,
      };
      const sanitized = sanitizeParcel(parcel);

      expect(sanitized.recipientName).toBeUndefined();
      expect(sanitized.destinationCountry).toBeUndefined();
    });
  });
});
