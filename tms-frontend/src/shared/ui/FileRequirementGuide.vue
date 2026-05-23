<template>
  <section class="requirement-guide" :class="{ 'requirement-guide--compact': compact }">
    <div class="guide-heading">
      <p>文件准备</p>
      <h3>{{ guide.summary }}</h3>
    </div>

    <div class="guide-grid">
      <article v-for="file in guide.files" :key="file.name" class="guide-file">
        <span class="file-status" aria-hidden="true">✓</span>
        <span class="file-copy">
          <strong>{{ file.name }}</strong>
          <small>{{ file.detail }}</small>
        </span>
        <em v-if="file.required">必传</em>
      </article>
    </div>

    <ul class="guide-notes">
      <li v-for="note in guide.notes" :key="note">{{ note }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
type FileRequirementOwner = 'Jessca' | 'Sophia & Tina' | 'Jane'

interface FileRequirementGuideModel {
  summary: string
  files: Array<{
    name: string
    detail: string
    required: boolean
  }>
  notes: string[]
}

const props = withDefaults(
  defineProps<{
    owner: FileRequirementOwner
    mode?: 'overview' | 'compact'
  }>(),
  {
    mode: 'overview',
  },
)

const compact = props.mode === 'compact'

const guides: Record<FileRequirementOwner, FileRequirementGuideModel> = {
  Jessca: {
    summary: '发票价格与参考表核对',
    files: [
      {
        name: '发票文件',
        detail: '可多选，支持 .xls / .xlsx',
        required: true,
      },
      {
        name: '参考表文件',
        detail: '只上传 1 个，支持 .xls / .xlsx',
        required: true,
      },
    ],
    notes: [
      '处理前会检查必传文件是否齐全。',
      '输出价格差异和缺失款号整理结果。',
    ],
  },
  'Sophia & Tina': {
    summary: '多类 Excel 文件统一合并',
    files: [
      {
        name: 'TMS 文件',
        detail: '可多选，支持 .xls / .xlsx',
        required: true,
      },
      {
        name: 'Article 文件',
        detail: '可多选，支持 .xls / .xlsx',
        required: true,
      },
      {
        name: 'Factory Price 文件',
        detail: '可多选，支持 .xls / .xlsx',
        required: true,
      },
      {
        name: 'Pack 文件',
        detail: '可多选，支持 .xls / .xlsx',
        required: true,
      },
    ],
    notes: [
      '四类文件都需要至少上传 1 个。',
      '输出合并后的 Sophia & Tina 分析报表。',
    ],
  },
  Jane: {
    summary: '客户文件生成标准成品表',
    files: [
      {
        name: '客户文件',
        detail: '只上传 1 个，支持 .xls / .xlsx',
        required: true,
      },
      {
        name: 'country.xlsx',
        detail: '只上传 1 个，仅支持 .xlsx',
        required: true,
      },
    ],
    notes: [
      'Working Number 筛选为可选项，多个值用英文逗号分隔。',
      '输出标准成品表和对应统计结果。',
    ],
  },
}

const guide = guides[props.owner]
</script>

<style scoped>
.requirement-guide {
  display: grid;
  gap: 14px;
  margin-bottom: 22px;
  padding: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.requirement-guide--compact {
  margin-bottom: 20px;
}

.guide-heading {
  display: grid;
  gap: 4px;
}

.guide-heading p,
.guide-heading h3 {
  margin: 0;
}

.guide-heading p {
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
}

.guide-heading h3 {
  color: #172033;
  font-size: 18px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.guide-file {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 11px 12px;
  background: #ffffff;
  border: 1px solid #e6edf4;
  border-radius: 8px;
}

.file-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: #1f7a5d;
  font-size: 13px;
  font-weight: 900;
  background: #e5f5ef;
  border-radius: 999px;
}

.file-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.file-copy strong {
  color: #172033;
  font-size: 14px;
}

.file-copy small {
  color: #6b7a8b;
  font-size: 12px;
}

em {
  padding: 4px 8px;
  color: #334155;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
}

.guide-notes {
  display: grid;
  gap: 6px;
  padding: 0;
  margin: 0;
  color: #5c6c7f;
  font-size: 13px;
  list-style: none;
}

.guide-notes li::before {
  margin-right: 8px;
  color: #ca8a04;
  content: '!';
  font-weight: 900;
}

@media (max-width: 720px) {
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
