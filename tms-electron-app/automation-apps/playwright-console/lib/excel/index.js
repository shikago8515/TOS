const { BaseParser } = require('./base-parser');
const { InvoiceAdjustmentsParser } = require('./invoice-adjustments-parser');
const { ShipmentScanParser } = require('./shipment-scan-parser');
const { BtpUploadAcceptParser } = require('./btp-upload-accept-parser');
const { GenericFormFillParser } = require('./generic-form-fill-parser');
const { BtpPoDecisionsParser } = require('./btp-po-decisions-parser');

const ParserRegistry = {
  'invoice-adjustments': InvoiceAdjustmentsParser,
  'shipment-scan': ShipmentScanParser,
  'btp-upload-accept': BtpUploadAcceptParser,
  'generic-form-fill': GenericFormFillParser,
  'sap-btp-po-decisions': BtpPoDecisionsParser
};

function createParser(workflowId, workflowConfig) {
  const ParserClass = ParserRegistry[workflowId];
  if (!ParserClass) {
    throw new Error(`No parser registered for workflow: ${workflowId}`);
  }
  return new ParserClass(workflowConfig);
}

function parseWorkbook(filePath, workflowId, workflowConfig) {
  const parser = createParser(workflowId, workflowConfig);
  return parser.parse(filePath);
}

module.exports = {
  BaseParser,
  InvoiceAdjustmentsParser,
  ShipmentScanParser,
  BtpUploadAcceptParser,
  GenericFormFillParser,
  BtpPoDecisionsParser,
  ParserRegistry,
  createParser,
  parseWorkbook
};
