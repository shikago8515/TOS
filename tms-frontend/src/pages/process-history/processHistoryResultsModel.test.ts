import { describe, expect, it } from 'vitest'

import {
  buildDefaultHistoryRange,
  filterDownloadableProcessRecords,
  filterLocalDownloadableProcessRecords,
  formatHistoryFileSize,
} from './processHistoryResultsModel'
import type { ProcessHistoryRecord } from '../../shared/process/processHistory'

describe('processHistoryResultsModel', () => {
  it('builds a 30 day default range ending at the provided time', () => {
    const range = buildDefaultHistoryRange(new Date('2026-07-01T12:00:00.000Z'))

    expect(range.createdFrom).toBe('2026-06-01T12:00:00.000Z')
    expect(range.createdTo).toBe('2026-07-01T12:00:00.000Z')
  })

  it('filters local fallback records by person modules, selected module, date and downloadability', () => {
    const records = filterLocalDownloadableProcessRecords(
      [
        buildRecord('excel-jane-bom-compare', '2026-06-30T00:00:00.000Z', true),
        buildRecord('jane', '2026-06-29T00:00:00.000Z', true),
        buildRecord('excel-jane-bom-compare', '2026-05-01T00:00:00.000Z', true),
        buildRecord('eric', '2026-06-30T00:00:00.000Z', true),
        buildRecord('excel-jane-bom-compare', '2026-06-30T00:00:00.000Z', false),
      ],
      {
        personId: 'jane',
        moduleId: 'excel-jane-bom-compare',
        createdFrom: '2026-06-01T00:00:00.000Z',
        createdTo: '2026-07-01T00:00:00.000Z',
      },
    )

    expect(records.map((record) => record.id)).toEqual(['excel-jane-bom-compare-2026-06-30T00:00:00.000Z'])
  })

  it('filters remote records without archived result download paths', () => {
    const records = filterDownloadableProcessRecords([
      buildRecord('downloadable', '2026-06-30T00:00:00.000Z', true),
      buildRecord('local-only', '2026-06-30T00:00:00.000Z', false),
    ])

    expect(records.map((record) => record.id)).toEqual(['downloadable-2026-06-30T00:00:00.000Z'])
  })

  it('formats file sizes for table rows', () => {
    expect(formatHistoryFileSize(512)).toBe('512 B')
    expect(formatHistoryFileSize(1536)).toBe('1.5 KB')
    expect(formatHistoryFileSize(1048576)).toBe('1.0 MB')
  })
})

function buildRecord(
  moduleId: string,
  createdAt: string,
  downloadable: boolean,
): ProcessHistoryRecord {
  return {
    id: `${moduleId}-${createdAt}`,
    moduleId,
    moduleName: moduleId,
    status: 'success',
    durationMs: 100,
    message: 'completed',
    inputFiles: ['source.xlsx'],
    outputFile: 'result.xlsx',
    resultFile: downloadable
      ? {
          id: 42,
          filename: 'result.xlsx',
          fileSize: 1536,
          downloadPath: '/api/process-history/files/42/download',
        }
      : undefined,
    resultDownloadPath: downloadable ? '/api/process-history/files/42/download' : undefined,
    summary: [],
    createdAt,
  }
}
