const { InvoiceAdjustmentsWorkflow } = require('./invoice-adjustments-workflow');
const { ShipmentScanWorkflow } = require('./shipment-scan-workflow');
const { BtpUploadAcceptWorkflow } = require('./btp-upload-accept-workflow');
const { GenericFormFillWorkflow } = require('./generic-form-fill-workflow');
const { BtpPoDecisionsWorkflow } = require('./btp-po-decisions-workflow');

const WorkflowRegistry = {
  'invoice-adjustments': InvoiceAdjustmentsWorkflow,
  'shipment-scan': ShipmentScanWorkflow,
  'btp-upload-accept': BtpUploadAcceptWorkflow,
  'generic-form-fill': GenericFormFillWorkflow,
  'sap-btp-po-decisions': BtpPoDecisionsWorkflow
};

function createWorkflow(workflowId, workflowConfig, options = {}) {
  const WorkflowClass = WorkflowRegistry[workflowId];
  if (!WorkflowClass) {
    throw new Error(`No workflow registered for: ${workflowId}`);
  }
  return new WorkflowClass(workflowConfig, options);
}

module.exports = {
  WorkflowRegistry,
  createWorkflow
};
