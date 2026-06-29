<template>
  <section class="workbench-col workbench-col--mid">
    <article class="card card-audit">
      <div class="card-glow-bar card-glow-bar--slate" />
      <header class="card-header">
        <div class="card-heading">
          <div class="card-icon card-icon--slate">
            <AppIcon name="list" />
          </div>
          <div>
            <h2>{{ text('排序与核对中心') }}</h2>
            <p>{{ text('微调 PO 顺序，并实时比对 PO 页码匹配状态') }}</p>
          </div>
        </div>
        <span class="badge success">{{ parsedPoCount }} {{ text('个 PO') }}</span>
      </header>

      <div class="card-body">
        <label class="field-label" for="po-order-text">
          <span>{{ text('PO 顺序列表 (一行一个)') }}</span>
          <small>{{ parsedPoCount }} {{ text('个有效 PO') }}</small>
        </label>
        <textarea
          id="po-order-text"
          :value="poOrderText"
          @input="emit('update:poOrderText', ($event.target as HTMLTextAreaElement).value)"
          class="textarea po-editor-textarea"
          placeholder="4501749160&#10;4501749225&#10;4501749152"
        />

        <div class="toolbar justify-between">
          <div class="flex-wrap gap-xs">
            <button class="btn btn-soft" type="button" @click="emit('refreshMatches')">
              <AppIcon name="refresh-cw" />
              {{ text('应用列表') }}
            </button>
            <button class="btn" type="button" @click="emit('copyPoOrder')">
              <AppIcon name="copy" />
              {{ text('复制列表') }}
            </button>
            <button class="btn" type="button" @click="emit('printSummary')">
              <AppIcon name="printer" />
              {{ text('打印摘要') }}
            </button>
          </div>
          <button class="btn btn-danger-soft" type="button" @click="emit('clearPoOrderOnly')">
            {{ text('清空列表') }}
          </button>
        </div>

        <div class="table-wrap full-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>PO</th>
                <th>{{ text('PO页') }}</th>
                <th>Article</th>
                <th class="num">{{ text('数量') }}</th>
                <th class="num">{{ text('货品金额') }}</th>
                <th>{{ text('状态') }}</th>
                <th>{{ text('操作') }}</th>
              </tr>
            </thead>
            <transition-group name="jason-row-fade" tag="tbody">
              <tr v-if="matchRows.length === 0" key="empty">
                <td colspan="8">
                  <div class="empty-state">
                    <AppIcon name="file-search" />
                    <span>{{ text('等待同步或输入 PO 列表') }}</span>
                  </div>
                </td>
              </tr>
              <tr v-for="(row, index) in matchRows" :key="row.po" v-else>
                <td>{{ index + 1 }}</td>
                <td><strong>{{ row.po }}</strong></td>
                <td>{{ formatPages(row.pages) }}</td>
                <td>{{ valueOrDash(row.articleNo) }}</td>
                <td class="num">{{ valueOrDash(row.quantity) }}</td>
                <td class="num">{{ valueOrDash(row.totalAmount) }}</td>
                <td>
                  <span :class="['tag', row.found ? 'tag-success' : 'tag-warn']">
                    {{ row.found ? text('已匹配') : text('未找到') }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-soft" type="button" :disabled="isBusy(`single-${row.po}`)" @click="emit('generateSinglePo', row.po)">
                    {{ isBusy(`single-${row.po}`) ? text('生成中...') : text('单独生成') }}
                  </button>
                </td>
              </tr>
            </transition-group>
          </table>
        </div>

        <slot name="po-message"></slot>

        <p v-if="extraPoNumbers.length" class="extra-note">
          {{ text('PO PDF 中有但当前列表未包含') }}：{{ extraPoNumbers.join(', ') }}
        </p>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'

interface MatchRow {
  po: string
  pages?: number[]
  articleNo?: string | number | null
  quantity?: string | number | null
  totalAmount?: string | number | null
  found: boolean
}

interface Props {
  poOrderText: string
  matchRows: MatchRow[]
  extraPoNumbers: string[]
  parsedPoCount: number
  isBusy: (action: string) => boolean
}

defineProps<Props>()
const { text } = useAppLanguage()
const emit = defineEmits<{
  (e: 'update:poOrderText', text: string): void
  (e: 'refreshMatches'): void
  (e: 'copyPoOrder'): void
  (e: 'clearPoOrderOnly'): void
  (e: 'generateSinglePo', po: string): void
  (e: 'printSummary'): void
}>()

function valueOrDash(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

function formatPages(pages: number[] | undefined): string {
  return pages && pages.length > 0 ? pages.join(', ') : '-'
}
</script>

<style scoped>
.workbench-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-audit {
  background: var(--white);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.01), 0 4px 16px rgba(15, 23, 42, 0.02);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  height: 100%;
}

.card-audit:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.card-glow-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--gray-400), var(--gray-300));
}

.card-header {
  align-items: center;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px 16px;
}

.card-heading {
  align-items: center;
  display: flex;
  gap: 12px;
}

.card-icon {
  align-items: center;
  background: var(--gray-50);
  border-radius: 8px;
  color: var(--gray-500);
  display: inline-flex;
  justify-content: center;
  font-size: 16px;
  height: 32px;
  width: 32px;
}

.card-icon--slate {
  background: var(--gray-100);
  color: var(--gray-500);
}

.card-audit h2 {
  font-size: 14px;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0;
}

.card-audit p {
  color: var(--gray-500);
  font-size: 11px;
  margin: 2px 0 0;
}

.card-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  overflow-y: auto;
}

.badge {
  background: var(--gray-100);
  border-radius: 999px;
  color: var(--gray-500);
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
}

.badge.success {
  background: var(--green-light);
  color: var(--green);
}

.field-label {
  align-items: center;
  color: var(--gray-600);
  display: flex;
  font-size: 12px;
  font-weight: 800;
  justify-content: space-between;
  margin-top: 4px;
}

.field-label small {
  color: var(--gray-400);
  font-weight: 700;
}

.textarea {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  color: var(--gray-900);
  font: inherit;
  outline: none;
  padding: 8px 12px;
  font-size: 12px;
  transition: all 0.2s;
  font-family: "SF Mono", Consolas, monospace;
  line-height: 1.5;
  width: 100%;
  box-sizing: border-box;
}

.textarea:focus {
  background: var(--white);
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.po-editor-textarea {
  min-height: 110px;
  height: 110px;
  flex-shrink: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.justify-between {
  justify-content: space-between;
}

.flex-wrap {
  display: flex;
  flex-wrap: wrap;
}

.gap-xs {
  gap: 8px;
}

.btn {
  align-items: center;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  color: var(--gray-700);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
  justify-content: center;
  min-height: 32px;
  padding: 6px 12px;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  user-select: none;
}

.btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
  transform: translateY(-1.5px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.btn-soft {
  background: var(--blue-light);
  border-color: transparent;
  color: var(--blue);
}

.btn-soft:hover:not(:disabled) {
  background: #e0f2fe;
  color: var(--blue-dark);
}

.btn-danger-soft {
  background: var(--red-light);
  border-color: transparent;
  color: var(--red);
}

.btn-danger-soft:hover:not(:disabled) {
  background: #fee2e2;
}

.table-wrap {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  overflow: auto;
}

.full-table {
  flex: 1;
  min-height: 180px;
  max-height: none;
}

table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}

th, td {
  border-bottom: 1px solid var(--gray-100);
  padding: 8px 10px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  background: var(--gray-50);
  color: var(--gray-500);
  font-size: 10px;
  font-weight: 800;
  position: sticky;
  top: 0;
  z-index: 1;
}

.num {
  text-align: right;
}

.empty-state {
  align-items: center;
  color: var(--gray-400);
  display: flex;
  font-size: 12px;
  gap: 8px;
  justify-content: center;
  min-height: 64px;
}

.tag {
  border-radius: 999px;
  display: inline-flex;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
}

.tag-success {
  background: var(--green-light);
  color: var(--green-dark);
}

.tag-warn {
  background: var(--amber-light);
  color: var(--amber);
}

.extra-note {
  background: var(--amber-light);
  border-radius: 6px;
  color: var(--amber);
  font-size: 11px;
  font-weight: 700;
  margin: 0;
  padding: 8px 12px;
}

.jason-row-fade-enter-active,
.jason-row-fade-leave-active {
  transition: all 0.3s ease;
}

.jason-row-fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.jason-row-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
