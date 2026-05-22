const { BaseWorkflow } = require('./base-workflow');
const { delay } = require('../core');

class BtpUploadAcceptWorkflow extends BaseWorkflow {
  async execute(page, parsedWorkbook, logger) {
    await this.waitForReadyMarker(page, this.config.selectors.readyMarker, 180000, logger);

    await page.getByRole('link', { name: 'Task Center 76 saas_approuter' }).click();
    await page.waitForTimeout(3000);
    
    const iframe = page.locator('iframe[title="Application"]').contentFrame();
    
    await iframe.locator('#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow').click();
    await page.waitForTimeout(500);
    await iframe.getByRole('checkbox', { name: 'Select All (0 of 4)' }).click();
    await page.waitForTimeout(500);
    await iframe.getByLabel('Available Values').getByText('Initiate Cancellation Request').click();
    await page.waitForTimeout(500);
    await iframe.getByRole('button', { name: 'Go' }).click();
    await page.waitForTimeout(3000);

    for (let i = 0; i < parsedWorkbook.items.length; i++) {
      const item = parsedWorkbook.items[i];
      logger(`[${i + 1}/${parsedWorkbook.items.length}] Processing task: ${item.taskId}`);

      try {
        const taskRow = iframe.getByRole('row', { name: new RegExp(`Review Sub-Ticket Resolution.*${item.taskId}.*Review Sub-Ticket`) });
        await taskRow.waitFor({ state: 'visible', timeout: 10000 });
        await taskRow.getByLabel('Open Menu', { exact: true }).click();
        
        const page1Promise = page.waitForEvent('popup');
        await iframe.locator('[id="__item2-__clone1-application-taskcenter-display-component---inboxTable--ResponseOptionsMenu-__clone1-0-txt"]').click();
        const page1 = await page1Promise;
        
        await page1.waitForTimeout(2000);
        const appIframe = page1.locator('iframe[title="Application"]').contentFrame();
        
        await appIframe.locator('[id="__xmlview3--table-rows-row0-treeicon"]').click();
        await page1.waitForTimeout(500);
        await appIframe.getByRole('gridcell', { name: 'Decision' }).getByLabel('Select Options').click();
        await page1.waitForTimeout(500);
        
        if (item.decision === 'reject' || item.decision === '拒绝') {
          await appIframe.getByLabel('Available Values').getByText('Reject').click();
          logger(`Task ${item.taskId} - Decision: Reject`);
        } else {
          await appIframe.getByLabel('Available Values').getByText('Accept').click();
          logger(`Task ${item.taskId} - Decision: Accept`);
        }
        
        await page1.waitForTimeout(1000);
        await page1.close();
        logger(`Task ${item.taskId} completed`);
        
        if (i < parsedWorkbook.items.length - 1) {
          logger('Waiting before next task...');
          await page.waitForTimeout(2000);
        }
        
      } catch (error) {
        logger(`Error processing task ${item.taskId}: ${error.message}`);
        throw error;
      }
    }
  }
}

module.exports = { BtpUploadAcceptWorkflow };
