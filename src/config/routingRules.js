/**
 * Routing Rules Configuration
 *
 * This module defines the business rules for parcel routing.
 * Rules are evaluated in order, and the first matching rule determines the department.
 *
 * EXTENSIBILITY: New rules can be added by extending the rulesConfig array.
 * Each rule is independent and can be modified without affecting others.
 *
 * SAFETY: Rules are validated at startup. Invalid configurations will throw errors.
 * Each rule must have: condition (function), department (string), and priority (number).
 */

/**
 * Define routing rules
 * Rules are evaluated in priority order (lower number = higher priority)
 * Each rule returns a routing decision object
 */
const rulesConfig = [
  {
    id: 'insurance-required',
    priority: 1,
    name: 'Insurance Approval Required',
    description: 'High-value parcels (>€1000) require insurance approval',
    condition: (parcel) => parcel.value > 1000,
    outcome: {
      department: 'Insurance',
      requiresApproval: true,
      reason: 'Value exceeds €1000 threshold',
    },
  },
  {
    id: 'mail-light',
    priority: 2,
    name: 'Mail Department (Light)',
    description: 'Parcels up to 1kg go to Mail Department',
    condition: (parcel) => parcel.weight <= 1,
    outcome: {
      department: 'Mail',
      requiresApproval: false,
      reason: 'Weight ≤ 1kg',
    },
  },
  {
    id: 'regular-medium',
    priority: 3,
    name: 'Regular Department (Medium)',
    description: 'Parcels 1kg-10kg go to Regular Department',
    condition: (parcel) => parcel.weight > 1 && parcel.weight <= 10,
    outcome: {
      department: 'Regular',
      requiresApproval: false,
      reason: 'Weight between 1kg and 10kg',
    },
  },
  {
    id: 'heavy-freight',
    priority: 4,
    name: 'Heavy Department (Heavy)',
    description: 'Parcels over 10kg go to Heavy Department',
    condition: (parcel) => parcel.weight > 10,
    outcome: {
      department: 'Heavy',
      requiresApproval: false,
      reason: 'Weight > 10kg',
    },
  },
];

/**
 * Validate routing rules configuration
 * Ensures all rules have required fields and valid conditions
 */
function validateRulesConfig(rules) {
  const requiredFields = ['id', 'priority', 'condition', 'outcome'];
  const requiredOutcomeFields = ['department', 'requiresApproval', 'reason'];

  rules.forEach((rule, index) => {
    // Check required fields
    requiredFields.forEach((field) => {
      if (!(field in rule)) {
        throw new Error(
          `Rule at index ${index} missing required field: ${field}`
        );
      }
    });

    // Validate condition is a function
    if (typeof rule.condition !== 'function') {
      throw new Error(`Rule "${rule.id}" condition must be a function`);
    }

    // Validate outcome object
    requiredOutcomeFields.forEach((field) => {
      if (!(field in rule.outcome)) {
        throw new Error(
          `Rule "${rule.id}" outcome missing required field: ${field}`
        );
      }
    });

    // Validate department is a non-empty string
    if (typeof rule.outcome.department !== 'string' || !rule.outcome.department.trim()) {
      throw new Error(`Rule "${rule.id}" outcome department must be a non-empty string`);
    }
  });

  // Check for duplicate IDs
  const ids = rules.map((r) => r.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate rule IDs found: ${duplicates.join(', ')}`);
  }

  // Check for duplicate priorities
  const priorities = rules.map((r) => r.priority);
  const duplicatePriorities = priorities.filter((p, i) => priorities.indexOf(p) !== i);
  if (duplicatePriorities.length > 0) {
    console.warn(`Warning: Duplicate rule priorities found: ${duplicatePriorities.join(', ')}`);
  }
}

// Validate configuration at module load time
try {
  validateRulesConfig(rulesConfig);
} catch (error) {
  console.error('Fatal error in routing rules configuration:', error.message);
  process.exit(1);
}

/**
 * Get all available routing rules
 * @returns {Array} Array of rule definitions
 */
function getAllRules() {
  return rulesConfig.map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    priority: rule.priority,
  }));
}

/**
 * Get a specific rule by ID
 * @param {string} ruleId - The ID of the rule to retrieve
 * @returns {Object|null} The rule object or null if not found
 */
function getRuleById(ruleId) {
  return rulesConfig.find((rule) => rule.id === ruleId) || null;
}

module.exports = {
  rulesConfig,
  validateRulesConfig,
  getAllRules,
  getRuleById,
};
