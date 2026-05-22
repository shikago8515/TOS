const { BaseWorkflow } = require('./base-workflow');
const { isConfigured, fillTemplate, collectMissingSelectors } = require('../core');

class InvoiceAdjustmentsWorkflow extends BaseWorkflow {
  getRequiredSelectors() {
    return ['rowTemplate', 'reasonModalRowByCode', 'fields.poNumber', 'fields.reasonLookup', 'fields.valueInput'];
  }

  async execute(page, parsedWorkbook, logger) {
    const selectors = this.config.selectors;
    const fields = selectors.fields || {};
    const missingSelectors = collectMissingSelectors(this.config, this.getRequiredSelectors());
    
    if (missingSelectors.length) {
      throw new Error(`Please configure these selectors: ${missingSelectors.join(', ')}`);
    }

    await this.waitForReadyMarker(page, selectors.readyMarker, 180000, logger);
    await this.ensureAdjustmentRows(page, parsedWorkbook.items.length, logger);

    for (let index = 0; index < parsedWorkbook.items.length; index++) {
      await this.fillInvoiceRow(page, parsedWorkbook.items[index], index, logger);
    }

    if (isConfigured(selectors.updateTotalsButton)) {
      await page.locator(selectors.updateTotalsButton).first().click();
      logger('Clicked Update Totals.');
    }
  }

  async ensureAdjustmentRows(page, neededCount, logger) {
    const preloadedRows = this.config.defaults?.preloadedRows || 0;
    if (neededCount <= preloadedRows) {
      return;
    }

    const addCountInput = this.config.selectors.addCountInput;
    const addButton = this.config.selectors.addButton;

    if (!isConfigured(addCountInput) || !isConfigured(addButton)) {
      logger('Skipping extra row creation because addCountInput/addButton selectors are not configured.');
      return;
    }

    const extraRows = neededCount - preloadedRows;
    logger(`Adding ${extraRows} extra adjustment rows.`);
    await page.locator(addCountInput).fill(String(extraRows));
    await page.locator(addButton).click();
  }

  async fillInvoiceRow(page, item, rowIndex, logger) {
    const selectors = this.config.selectors;
    const fields = selectors.fields;
    const rowSelector = fillTemplate(selectors.rowTemplate, {
      rowIndex: rowIndex + 1
    });
    const row = page.locator(rowSelector).first();

    await row.waitFor({
      state: 'visible',
      timeout: 15000
    });

    if (isConfigured(fields.adjustmentType)) {
      await row.locator(fields.adjustmentType).first().selectOption({
        label: this.config.defaults?.adjustmentType
      });
    }

    await row.locator(fields.poNumber).first().selectOption({
      label: item.poNumber
    });

    await row.locator(fields.reasonLookup).first().click();
    await page
      .locator(fillTemplate(selectors.reasonModalRowByCode, { code: item.reasonCode }))
      .first()
      .click();

    await row.locator(fields.valueInput).first().fill(String(item.value));

    if (isConfigured(fields.commentsInput)) {
      await row.locator(fields.commentsInput).first().fill(item.comment || item.remarks || '');
    }

    logger(`Row ${rowIndex + 1}: ${item.poNumber} -> ${item.reasonCode} = ${item.value}`);
  }
}

module.exports = { InvoiceAdjustmentsWorkflow };
