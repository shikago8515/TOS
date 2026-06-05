<template>
  <section class="requirement-guide" :class="{ 'requirement-guide--compact': compact }">
    <div class="guide-heading">
      <p>{{ text('文件准备') }}</p>
      <h3>{{ text(guide.summary) }}</h3>
    </div>

    <div class="guide-grid">
      <article v-for="file in guide.files" :key="file.name" class="guide-file">
        <span class="file-status" aria-hidden="true">✓</span>
        <span class="file-copy">
          <strong>{{ text(file.name) }}</strong>
          <small>{{ text(file.detail) }}</small>
        </span>
        <em v-if="file.required">{{ text('必传') }}</em>
      </article>
    </div>

    <ul class="guide-notes">
      <li v-for="note in guide.notes" :key="note">{{ text(note) }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useAppLanguage } from '../i18n/appLanguage'

type FileRequirementOwner =
  | 'Jessca'
  | 'Sophia & Tina'
  | 'Jane'
  | 'Jane - BOM汇总'
  | 'Jane - BOM核对'
  | 'Jane - OUTBOUND核对'

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
const { text } = useAppLanguage()

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
    summary: 'Copy of TMS 生成标准成品表',
    files: [
      {
        name: 'Copy of TMS',
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
  'Jane - BOM汇总': {
    summary: 'BOM MAIN COMPONENT 汇总',
    files: [
      {
        name: 'BOM 文件',
        detail: '可多选，支持 .xlsx / .xlsm',
        required: true,
      },
      {
        name: 'Pack.xlsx',
        detail: '只上传 1 个，需包含 Pack、Season、Working Number',
        required: true,
      },
    ],
    notes: [
      '按 Working # + Season 匹配 Pack.xlsx。若 Pack 映射冲突会终止处理。',
      '当前只汇总 BOM 里的 MAIN COMPONENT 物料，并按 Article/Color 展开。',
    ],
  },
  'Jane - BOM核对': {
    summary: 'T1 PRODUCTION 与 BOM汇总 面料核对',
    files: [
      {
        name: 'T1 PRODUCTION 文件',
        detail: '只上传 1 个，支持 .xlsx / .xlsm',
        required: true,
      },
      {
        name: 'BOM汇总 文件',
        detail: '只上传 1 个，支持 .xlsx / .xlsm',
        required: true,
      },
    ],
    notes: [
      '按 Style ID + Recording Facility ID 匹配 BOM汇总 的 Articles + Factory。',
      '材料号或供应商不一致会标红；BOM汇总 有但生产表缺少的材料会写入诊断。',
    ],
  },
  'Jane - OUTBOUND核对': {
    summary: 'T1 OUTBOUND 与 TMS 出库核对',
    files: [
      {
        name: 'T1 OUTBOUND 文件',
        detail: '只上传 1 个，支持 .xlsx / .xlsm',
        required: true,
      },
      {
        name: 'Copy of TMS',
        detail: '只上传 1 个，需包含 Result Set',
        required: true,
      },
    ],
    notes: [
      '按 Style Number + PO Number + Line Number + Recording Facility ID 匹配 TMS。',
      'TMS 会先按 T1 的 Working Number 范围过滤，避免全量报表无关订单进入结果。',
      '数量、PODD 或 Working Number 不一致会标红，并输出 OUTBOUND_Check 明细表。',
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
  border-radius: 12px;
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
  color: #0d9488;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.guide-heading h3 {
  color: #1e293b;
  font-size: 18px;
  font-weight: 700;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.guide-file {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 60px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.guide-file:hover {
  border-color: #99f6e4;
  background: #f0fdfa;
}

.file-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
  background: linear-gradient(135deg, #34d399, #059669);
  border-radius: 999px;
}

.file-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.file-copy strong {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

.file-copy small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

em {
  padding: 4px 10px;
  color: #0d9488;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  border-radius: 999px;
}

.guide-notes {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  color: #64748b;
  font-size: 13px;
  list-style: none;
}

.guide-notes li::before {
  margin-right: 8px;
  color: #d97706;
  content: '!';
  font-weight: 900;
}

@media (max-width: 720px) {
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
