const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const logger = require('../config/logger').child({ origin: 'file-parser' });

/**
 * File Parser Service
 *
 * Handles parsing of batch parcel data from XML and JSON files.
 * Abstracts file format handling and provides consistent parcel output.
 *
 * DESIGN RATIONALE:
 * - XML chosen for batch uploads (better structure for complex hierarchies)
 * - JSON also supported for API flexibility
 * - Separates file handling from routing logic
 */

class FileParserService {
  constructor() {
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
    });
  }

  /**
   * Parse a batch file (XML or JSON)
   *
   * @param {string} filePath - Path to the file
   * @param {string} format - File format ('xml' or 'json')
   * @returns {Promise<Array>} Array of parcel objects
   * @throws {Error} If file cannot be read or parsed
   */
  async parseFile(filePath, format = 'xml') {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileSize = fs.statSync(filePath).size;
      if (fileSize > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('File size exceeds maximum limit (50MB)');
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return this.parseContent(fileContent, format);
    } catch (error) {
      logger.error('File parsing failed: %s', error.message, { filePath, format });
      throw new Error(`Failed to parse ${format.toUpperCase()} file: ${error.message}`);
    }
  }

  /**
   * Parse string content from XML or JSON sources
   *
   * @param {string} content - File content as string
   * @param {string} format - File format ('xml' or 'json')
   * @returns {Promise<Array>} Array of parcel objects
   */
  async parseContent(content, format = 'xml') {
    if (format.toLowerCase() === 'xml') {
      return this.parseXML(content);
    }

    if (format.toLowerCase() === 'json') {
      return this.parseJSON(content);
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * Parse XML content
   *
   * @param {string} xmlContent - XML string content
   * @returns {Promise<Array>} Array of parcel objects
   * @private
   */
  async parseXML(xmlContent) {
    try {
      const parsed = await this.xmlParser.parseStringPromise(xmlContent);

      // Extract parcels from the container
      if (!parsed.Container || !parsed.Container.parcels) {
        throw new Error('Invalid XML structure: missing Container or parcels element');
      }

      const parcelsData = parsed.Container.parcels.Parcel;
      if (!parcelsData) {
        throw new Error('No parcels found in XML');
      }

      // Ensure parcelsData is an array
      const parcelsArray = Array.isArray(parcelsData) ? parcelsData : [parcelsData];

      return parcelsArray.map((parcel) => this.normalizeParcelData(parcel));
    } catch (error) {
      throw new Error(`XML parsing error: ${error.message}`);
    }
  }

  /**
   * Parse JSON content
   *
   * @param {string} jsonContent - JSON string content
   * @returns {Array} Array of parcel objects
   * @private
   */
  parseJSON(jsonContent) {
    try {
      const parsed = JSON.parse(jsonContent);

      let parcelsData = [];
      if (Array.isArray(parsed)) {
        parcelsData = parsed;
      } else if (parsed.parcels && Array.isArray(parsed.parcels)) {
        parcelsData = parsed.parcels;
      } else if (parsed.parcels && !Array.isArray(parsed.parcels)) {
        parcelsData = [parsed.parcels];
      } else {
        throw new Error('JSON must contain array of parcels or object with parcels property');
      }

      return parcelsData.map((parcel) => this.normalizeParcelData(parcel));
    } catch (error) {
      throw new Error(`JSON parsing error: ${error.message}`);
    }
  }

  /**
   * Normalize parcel data from various formats to standard format
   *
   * @param {Object} parcelData - Raw parcel data from file
   * @returns {Object} Normalized parcel object
   * @private
   */
  normalizeParcelData(parcelData) {
    // Handle nested Weight/Value elements
    const weight = typeof parcelData.Weight === 'object' 
      ? parseFloat(parcelData.Weight._) 
      : parseFloat(parcelData.Weight || parcelData.weight || 0);

    const value = typeof parcelData.Value === 'object'
      ? parseFloat(parcelData.Value._)
      : parseFloat(parcelData.Value || parcelData.value || 0);

    const recipientName = parcelData.Recipient?.Name
      || parcelData.Receipient?.Name
      || parcelData.recipient?.name
      || parcelData.recipientName
      || 'Unknown';

    const destinationCountry = parcelData.destinationCountry
      || parcelData.DestinationCountry
      || parcelData.Destination
      || 'Unknown';

    return {
      weight: isNaN(weight) ? 0 : weight,
      value: isNaN(value) ? 0 : value,
      recipientName,
      destinationCountry,
    };
  }

  /**
   * Save parcels to JSON file
   *
   * @param {string} filePath - Output file path
   * @param {Array} parcels - Parcels to save
   * @returns {Promise<void>}
   */
  async saveToJSON(filePath, parcels) {
    try {
      const outputDir = path.dirname(filePath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(parcels, null, 2));
      logger.info('Parcels saved to JSON', { filePath, count: parcels.length });
    } catch (error) {
      logger.error('Failed to save JSON: %s', error.message);
      throw error;
    }
  }
}

module.exports = FileParserService;
