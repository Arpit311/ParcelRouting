const logger = require('../config/logger').child({ origin: 'routing-engine' });
const { rulesConfig } = require('../config/routingRules');

/**
 * Routing Engine
 * 
 * Implements the core routing logic for parcels.
 * Evaluates each parcel against configured business rules in priority order.
 *
 * DESIGN PRINCIPLES:
 * - Single Responsibility: Focuses only on routing decisions
 * - Immutability: Does not modify input parcel objects
 * - Observability: Returns detailed decision information for auditing
 * - Extensibility: Rules are defined externally and can be updated without code changes
 */

class RoutingEngine {
  /**
   * Initialize the routing engine
   */
  constructor() {
    this.rules = rulesConfig.sort((a, b) => a.priority - b.priority);
    logger.info('RoutingEngine initialized with %d rules', this.rules.length);
  }

  /**
   * Route a single parcel to the appropriate department
   *
   * @param {Object} parcel - The parcel to route
   * @param {number} parcel.weight - Weight in kilograms
   * @param {number} parcel.value - Value in euros
   * @param {string} parcel.destinationCountry - Destination country code (optional)
   *
   * @returns {Object} Routing decision object
   * @returns {string} result.department - The target department
   * @returns {boolean} result.requiresApproval - Whether approval is needed
   * @returns {string} result.reason - Human-readable reason for routing decision
   * @returns {string} result.appliedRule - The ID of the rule that matched
   * @returns {boolean} result.success - Whether routing was successful
   * @returns {string} result.error - Error message if routing failed
   * @throws {Error} If parcel validation fails
   */
  routeParcel(parcel) {
    try {
      // Validate parcel structure
      this.validateParcel(parcel);

      // Find the first matching rule
      for (const rule of this.rules) {
        try {
          if (rule.condition(parcel)) {
            const decision = {
              department: rule.outcome.department,
              requiresApproval: rule.outcome.requiresApproval,
              reason: rule.outcome.reason,
              appliedRule: rule.id,
              success: true,
            };

            logger.debug('Parcel routed successfully', {
              weight: parcel.weight,
              value: parcel.value,
              department: decision.department,
              rule: rule.id,
            });

            return decision;
          }
        } catch (error) {
          logger.error('Error evaluating rule %s: %s', rule.id, error.message);
          throw new Error(`Rule evaluation failed for rule "${rule.id}": ${error.message}`);
        }
      }

      // Fallback: No rule matched (should not happen with current rule set)
      const fallbackDecision = {
        department: 'Default',
        requiresApproval: false,
        reason: 'No specific rule matched, using default routing',
        appliedRule: 'fallback',
        success: true,
      };

      logger.warn('Parcel matched no specific rule, using fallback', {
        weight: parcel.weight,
        value: parcel.value,
      });

      return fallbackDecision;
    } catch (error) {
      logger.error('Parcel routing failed: %s', error.message, { parcel });
      return {
        success: false,
        error: error.message,
        department: null,
      };
    }
  }

  /**
   * Route multiple parcels (batch processing)
   *
   * @param {Array} parcels - Array of parcel objects
   * @returns {Object} Batch routing result
   * @returns {Array} result.parcels - Array of routed parcels with decisions
   * @returns {number} result.totalCount - Total number of parcels
   * @returns {number} result.successCount - Successfully routed parcels
   * @returns {number} result.failureCount - Failed parcels
   * @returns {Object} result.departmentCounts - Count of parcels per department
   */
  routeBatch(parcels) {
    if (!Array.isArray(parcels)) {
      logger.error('Batch routing failed: input is not an array');
      return {
        success: false,
        error: 'Input must be an array of parcels',
      };
    }

    const startTime = Date.now();
    const results = [];
    const departmentCounts = {};
    let successCount = 0;
    let failureCount = 0;

    for (let index = 0; index < parcels.length; index += 1) {
      try {
        const decision = this.routeParcel(parcels[index]);

        if (decision.success) {
          successCount += 1;
          const deptName = decision.department;
          departmentCounts[deptName] = (departmentCounts[deptName] || 0) + 1;
        } else {
          failureCount += 1;
        }

        results.push({
          index,
          parcel: parcels[index],
          decision,
        });
      } catch (error) {
        failureCount += 1;
        results.push({
          index,
          parcel: parcels[index],
          decision: {
            success: false,
            error: error.message,
          },
        });
      }
    }

    const processingTime = Date.now() - startTime;

    logger.info('Batch routing completed', {
      totalCount: parcels.length,
      successCount,
      failureCount,
      processingTimeMs: processingTime,
      departmentCounts,
    });

    return {
      success: true,
      parcels: results,
      totalCount: parcels.length,
      successCount,
      failureCount,
      departmentCounts,
      processingTimeMs: processingTime,
    };
  }

  /**
   * Validate parcel object structure and required fields
   *
   * @param {Object} parcel - Parcel to validate
   * @throws {Error} If parcel is invalid
   */
  validateParcel(parcel) {
    if (!parcel || typeof parcel !== 'object') {
      throw new Error('Parcel must be a non-null object');
    }

    // Check required fields
    if (typeof parcel.weight !== 'number' || parcel.weight < 0) {
      throw new Error('Parcel weight must be a non-negative number');
    }

    if (typeof parcel.value !== 'number' || parcel.value < 0) {
      throw new Error('Parcel value must be a non-negative number');
    }

    // Weight and value must be reasonable
    if (parcel.weight > 1000) {
      throw new Error('Parcel weight exceeds maximum limit (1000kg)');
    }

    if (parcel.value > 1000000) {
      throw new Error('Parcel value exceeds maximum limit (€1,000,000)');
    }
  }

  /**
   * Get information about all available rules
   * Useful for API documentation and rule discovery
   *
   * @returns {Array} Array of rule metadata
   */
  getAvailableRules() {
    return this.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
    }));
  }
}

module.exports = RoutingEngine;
