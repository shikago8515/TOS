const { BaseWorkflow } = require('./base-workflow');
const { isConfigured, collectMissingSelectors } = require('../core');

class ShipmentScanWorkflow extends BaseWorkflow {
  getRequiredSelectors() {
    return ['scanInput'];
  }

  async execute(page, parsedWorkbook, logger) {
    const selectors = this.config.selectors;
    const missingSelectors = collectMissingSelectors(this.config, this.getRequiredSelectors());
    
    if (missingSelectors.length) {
      throw new Error(`Please configure these selectors: ${missingSelectors.join(', ')}`);
    }

    await this.waitForReadyMarker(page, selectors.readyMarker, 180000, logger);

    const input = page.locator(selectors.scanInput).first();

    for (const [index, item] of parsedWorkbook.items.entries()) {
      await input.fill(item.scanValue);

      if (isConfigured(selectors.submitButton)) {
        await page.locator(selectors.submitButton).first().click();
      } else {
        await input.press('Enter');
      }

      logger(`Scanned ${index + 1}/${parsedWorkbook.items.length}: ${item.scanValue}`);
    }
  }
}

module.exports = { ShipmentScanWorkflow };
