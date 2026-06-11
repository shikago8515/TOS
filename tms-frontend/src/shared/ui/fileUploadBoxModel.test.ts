import { describe, expect, it } from 'vitest'

import { getNextUploadFiles } from './fileUploadBoxModel'

function makeFile(name: string): File {
  return new File(['content'], name)
}

describe('fileUploadBoxModel', () => {
  it('keeps only the first dropped file for single-file fields', () => {
    const firstFile = makeFile('internal.xlsx')
    const secondFile = makeFile('bulk.xlsx')

    expect(getNextUploadFiles([], [firstFile, secondFile], false)).toEqual([firstFile])
  })

  it('keeps all dropped files for multi-file fields', () => {
    const firstFile = makeFile('sample.xlsx')
    const secondFile = makeFile('bulk.xlsx')

    expect(getNextUploadFiles([], [firstFile, secondFile], true)).toEqual([
      firstFile,
      secondFile,
    ])
  })

  it('keeps current files when the drop event contains no files', () => {
    const currentFile = makeFile('current.xlsx')

    expect(getNextUploadFiles([currentFile], [], true)).toEqual([currentFile])
  })
})
