const { BaseWorkflow } = require('./base-workflow');
const { parseSelector, delay } = require('../core');

class GenericFormFillWorkflow extends BaseWorkflow {
  async execute(page, parsedWorkbook, logger) {
    logger('══════════════════════════════════════════════');
    logger('         开始 SAP BTP PO 决策自动化处理');
    logger('      🤖👆 人类轨迹鼠标模式 - Ghost Cursor');
    logger('══════════════════════════════════════════════');
    
    const selectors = this.config.selectors;
    const keyColumn = this.config.excel?.keyColumn || 'poNumber';
    
    await this.waitForReadyMarker(page, parseSelector(selectors.readyMarker), 180000, logger);
    logger('✓ 页面已就绪');
    
    logger('→ 🎯 创建人类光标...');
    const cursor = this.createCursor(page, {
      noise: 20,
      overshootRadius: 2,
      randomizeClickPosition: true
    });
    logger('✓ 人类光标已就绪！');
    
    logger('\n──────────────────────────────────────────────');
    logger('步骤 1: 进入 Task Center');
    logger('──────────────────────────────────────────────');
    logger('→ 查找并点击 Task Center 链接...');
    const taskCenterLink = page.getByRole('link', { name: /Task Center.*68.*saas_approuter/i });
    await taskCenterLink.waitFor({ state: 'visible', timeout: 30000 });
    await cursor.moveAndClick(taskCenterLink);
    logger('✓ 已点击 Task Center 链接');
    await delay(5000);
    
    logger('\n──────────────────────────────────────────────');
    logger('步骤 2: 配置任务筛选器');
    logger('──────────────────────────────────────────────');
    logger('→ 获取 iframe 内容');
    const iframe = page.locator(selectors.iframe).contentFrame();
    logger('✓ iframe 已获取');
    
    logger('→ 点击任务筛选箭头');
    const taskFilterArrow = iframe.locator(selectors.taskFilterArrow);
    await taskFilterArrow.waitFor({ state: 'visible', timeout: 10000 });
    await cursor.moveAndClick(taskFilterArrow);
    await delay(500);
    logger('✓ 筛选器已打开');
    
    logger(`→ 勾选 "${selectors.selectAllCheckbox}"`);
    const selectAllCheckbox = iframe.getByRole('checkbox', { name: selectors.selectAllCheckbox });
    await selectAllCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    await cursor.moveAndClick(selectAllCheckbox);
    await delay(500);
    logger('✓ 已选择所有任务类型');
    
    logger(`→ 选择任务类型: "${selectors.taskTypeOption}"`);
    const taskTypeOption = iframe.getByLabel('Available Values').getByText(selectors.taskTypeOption);
    await taskTypeOption.waitFor({ state: 'visible', timeout: 5000 });
    await cursor.moveAndClick(taskTypeOption);
    await delay(500);
    logger('✓ 任务类型已选择');
    
    logger('→ 点击 Go 按钮执行筛选');
    const goButton = iframe.getByRole('button', { name: selectors.goButton });
    await goButton.waitFor({ state: 'visible', timeout: 5000 });
    await cursor.moveAndClick(goButton);
    await delay(3000);
    logger('✓ 任务列表已加载');
    
    logger('\n──────────────────────────────────────────────');
    logger(`步骤 3: 处理 ${parsedWorkbook.items.length} 个 PO`);
    logger('──────────────────────────────────────────────');
    
    for (let i = 0; i < parsedWorkbook.items.length; i++) {
      const item = parsedWorkbook.items[i];
      const poNumber = item[keyColumn];
      const decision = (item.decision || '').toLowerCase();
      const comments = item.comments || '无备注';
      
      logger(`\n【PO ${i + 1}/${parsedWorkbook.items.length}】`);
      logger(`┌────────────────────────────────────────────`);
      logger(`│ PO Number:  ${poNumber}`);
      logger(`│ Decision:   ${decision.toUpperCase()}`);
      logger(`│ Comments:  ${comments}`);
      logger(`└────────────────────────────────────────────`);
      
      try {
        const taskRowPattern = selectors.taskRowPattern.replace('{poNumber}', poNumber);
        
        logger('→ 查找任务行...');
        const taskRow = iframe.getByRole('row', { name: taskRowPattern });
        await taskRow.waitFor({ state: 'visible', timeout: 10000 });
        logger('✓ 找到任务行');
        
        logger('→ 点击 Open Menu...');
        const openMenu = taskRow.getByLabel(selectors.openMenu, { exact: true });
        await openMenu.waitFor({ state: 'visible', timeout: 5000 });
        await cursor.moveAndClick(openMenu);
        logger('✓ Open Menu 已打开');
        
        logger('→ 点击 Open in App...');
        const popupPromise = page.waitForEvent('popup');
        const openInApp = iframe.getByRole('menuitem', { name: selectors.openInApp });
        await openInApp.waitFor({ state: 'visible', timeout: 5000 });
        await cursor.moveAndClick(openInApp);
        const popupPage = await popupPromise;
        logger('✓ 已打开任务详情弹窗');
        
        logger('→ 等待弹窗加载...');
        await delay(3000);
        const appIframe = popupPage.locator(selectors.iframe).contentFrame();
        logger('✓ 弹窗内容已加载');
        
        logger('→ 等待 PO Details 表格加载...');
        await appIframe.getByRole('grid').waitFor({ state: 'visible', timeout: 10000 });
        logger('✓ PO Details 表格已加载');
        
        logger(`→ 在表格中查找 PO ${poNumber}...`);
        const poRow = appIframe.getByRole('row', { name: new RegExp(`.*${poNumber}.*Decision`) });
        await poRow.waitFor({ state: 'visible', timeout: 10000 });
        logger(`✓ 找到 PO ${poNumber} 的行`);
        
        logger('→ 点击树图标展开详情...');
        const treeIcon = poRow.locator('button').first();
        await treeIcon.waitFor({ state: 'visible', timeout: 5000 });
        await cursor.moveAndClick(treeIcon);
        await delay(500);
        logger('✓ 详情已展开');
        
        logger('→ 定位 Decision 下拉框...');
        const decisionCell = poRow.getByRole('gridcell', { name: selectors.decisionLabel });
        await decisionCell.waitFor({ state: 'visible', timeout: 5000 });
        
        logger('→ 点击 Decision 下拉框...');
        const combobox = decisionCell.getByRole(selectors.decisionCombobox);
        await combobox.waitFor({ state: 'visible', timeout: 5000 });
        await cursor.moveAndClick(combobox);
        await delay(500);
        logger('✓ Decision 下拉框已打开');
        
        const optionText = (decision === 'reject' || decision === '拒绝') ? selectors.rejectOption : selectors.acceptOption;
        logger(`→ 选择 "${optionText}"...`);
        const option = appIframe.getByRole('option', { name: optionText });
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await cursor.moveAndClick(option);
        logger(`✓ 已选择 ${optionText}`);
        
        logger('→ 等待操作确认...');
        await delay(1000);
        
        logger('→ 关闭弹窗...');
        await popupPage.close();
        logger('✓ 弹窗已关闭');
        
        if (i < parsedWorkbook.items.length - 1) {
          logger('→ 等待 2 秒后处理下一个 PO...');
          await delay(2000);
        }
        
        logger(`✓ PO ${poNumber} 处理完成！`);
        
      } catch (error) {
        logger(`✗ 处理 PO ${poNumber} 时出错: ${error.message}`);
        throw error;
      }
    }
    
    logger('\n══════════════════════════════════════════════');
    logger('              自动化执行完成！');
    logger('══════════════════════════════════════════════');
    logger(`处理 PO 总数: ${parsedWorkbook.items.length}`);
    logger('══════════════════════════════════════════════');
  }
}

module.exports = { GenericFormFillWorkflow };
