import { describe, expect, it } from 'vitest'

import { translateStaticText } from '../../shared/i18n/appLanguage'
import { getEntryStatusLabel, webAutomationEntries } from './webAutomationModel'

function containsChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/u.test(value)
}

describe('webAutomationModel', () => {
  it('translates web automation card metadata in English mode', () => {
    const translatedFields = webAutomationEntries.flatMap((entry) => [
      entry.title,
      entry.subtitle,
      entry.description,
      ...entry.tags,
      getEntryStatusLabel(entry.status),
    ]).map((field) => ({
      field,
      translated: translateStaticText(field, 'en-US'),
    }))

    expect(translatedFields.filter(({ translated }) => containsChinese(translated))).toEqual([])
    expect(translatedFields.filter(({ field, translated }) => containsChinese(field) && translated === field)).toEqual([])
  })

  it('uses polished English labels for the highlighted automation cards', () => {
    const expectedTranslations = new Map([
      ['SAP BTP 自动登录', 'SAP BTP Automatic Login'],
      ['上传 Excel 后自动完成 Microsoft 登录与 SAP BTP 平台操作。', 'Upload Excel and automatically complete Microsoft login and SAP BTP platform actions.'],
      ['统计 ticket 归属 自动化', 'Ticket Ownership Statistics Automation'],
      ['SAP BTP Ticket 归属统计', 'SAP BTP Ticket Ownership Statistics'],
      ['登录 SAP BTP 后从 Task Center 采集 ticket 信息，并生成 Ticket ownership Excel。', 'Log in to SAP BTP, collect ticket information from Task Center, and generate the Ticket ownership Excel.'],
      ['新龙泰-shipping 自动化', 'Xinlongtai Shipping Automation'],
      ['TC INV 自动化', 'TC INV Automation'],
      ['TC INV 出货明细与费用录入自动化', 'TC INV shipping details and charge entry automation'],
      ['自动下载箱单', 'Packing List Auto Download'],
      ['Excel 箱单批量下载', 'Batch packing list download from Excel'],
    ])

    for (const [field, expected] of expectedTranslations) {
      expect(translateStaticText(field, 'en-US')).toBe(expected)
    }
  })
})
