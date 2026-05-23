const { BaseWorkflow } = require('./base-workflow');
const { InvoiceAdjustmentsWorkflow } = require('./invoice-adjustments-workflow');
const { ShipmentScanWorkflow } = require('./shipment-scan-workflow');
const { BtpUploadAcceptWorkflow } = require('./btp-upload-accept-workflow');
const { GenericFormFillWorkflow } = require('./generic-form-fill-workflow');
const { BtpPoDecisionsWorkflow } = require('./btp-po-decisions-workflow');
const { WorkflowRegistry, createWorkflow } = require('./workflow-registry');
const { runAutomation, launchPage } = require('./workflow-runner');

module.exports = {
  BaseWorkflow,
  InvoiceAdjustmentsWorkflow,
  ShipmentScanWorkflow,
  BtpUploadAcceptWorkflow,
  GenericFormFillWorkflow,
  BtpPoDecisionsWorkflow,
  WorkflowRegistry,
  createWorkflow,
  runAutomation,
  launchPage
};
