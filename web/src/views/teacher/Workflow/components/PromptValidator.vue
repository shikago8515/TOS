<template>
  <div class="prompt-validator-container">
    <transition name="fade-scale" mode="out-in">
      <!-- State 1: Validating -->
      <div v-if="validating" class="status-card validating" key="validating">
        <div class="scan-effect"></div>
        <div class="content-wrapper compact-row">
          <div class="radar-spinner small">
            <div class="circle"></div>
            <div class="circle"></div>
          </div>
          <span class="primary-text">AI 智能检测中...</span>
        </div>
      </div>

      <!-- State 2: Validation Result -->
      <div v-else-if="validationResult" class="result-container" key="result">
        <!-- Status Header -->
        <div class="status-header" :class="statusClass">
          <div class="status-icon">
            <el-icon v-if="hasErrors"><CircleCloseFilled /></el-icon>
            <el-icon v-else-if="hasWarnings"><WarningFilled /></el-icon>
            <el-icon v-else><CircleCheckFilled /></el-icon>
          </div>
          <div class="status-info">
            <div class="status-title">{{ statusLabel }}</div>
            <div class="status-desc">{{ statusDesc }}</div>
          </div>
        </div>

        <!-- Issues List -->
        <div v-if="hasIssues" class="issues-panel">
          <transition-group name="list">
            <!-- Errors -->
            <div v-if="validationResult.errors?.length" class="issue-section error" key="errors">
              <div class="section-header text-error">
                <el-icon><CircleClose /></el-icon>
                <span>阻断性错误 ({{ validationResult.errors.length }})</span>
              </div>
              <ul class="issue-list">
                <li v-for="(err, i) in validationResult.errors" :key="'e'+i">
                  <span class="bullet"></span>
                  {{ err }}
                </li>
              </ul>
            </div>
            
            <!-- Warnings -->
            <div v-if="validationResult.warnings?.length" class="issue-section warning" key="warnings">
              <div class="section-header text-warning">
                <el-icon><Warning /></el-icon>
                <span>优化建议 ({{ validationResult.warnings.length }})</span>
              </div>
              <ul class="issue-list">
                <li v-for="(warn, i) in validationResult.warnings" :key="'w'+i">
                  <span class="bullet"></span>
                  {{ warn }}
                </li>
              </ul>
            </div>
          </transition-group>
        </div>
      </div>

      <!-- State 3: Empty/Initial -->
      <div v-else class="status-card empty" key="empty">
        <div class="empty-content-row">
          <el-icon class="mini-icon"><Monitor /></el-icon>
          <span>输入 Prompt 后自动开始 AI 校验</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { 
  CircleCheckFilled, WarningFilled, CircleCloseFilled, 
  CircleClose, Warning, Monitor
} from '@element-plus/icons-vue'
import { validatePrompt } from '@/api/teacher/case'
import { ElMessage } from 'element-plus'

const props = defineProps({
  prompt: String,
  agentType: String
})

const validating = ref(false)
const validationResult = ref(null)

// --- Computed Status ---
const hasErrors = computed(() => validationResult.value?.errors?.length > 0)
const hasWarnings = computed(() => validationResult.value?.warnings?.length > 0)
const hasIssues = computed(() => hasErrors.value || hasWarnings.value)

const statusClass = computed(() => {
  if (hasErrors.value) return 'is-error'
  if (hasWarnings.value) return 'is-warning'
  return 'is-success'
})

const statusLabel = computed(() => {
  if (hasErrors.value) return '校验未通过'
  if (hasWarnings.value) return '建议优化'
  return 'Prompt 格式完美'
})

const statusDesc = computed(() => {
  if (hasErrors.value) return `发现 ${validationResult.value.errors.length} 个阻断性问题`
  if (hasWarnings.value) return `发现 ${validationResult.value.warnings.length} 个可改进点`
  return '结构完整，变量清晰，可放心使用'
})

// --- Logic ---
const performValidation = async (promptText) => {
  if (!promptText || promptText.trim().length === 0) {
    validationResult.value = null
    return
  }
  
  validating.value = true
  
  try {
    const response = await validatePrompt(promptText, props.agentType)
    if (response.code === 200) {
      validationResult.value = response.data
    } else {
      ElMessage.error('验证失败：' + response.message)
      validationResult.value = null
    }
  } catch (error) {
    console.error('Prompt validation error:', error)
    validationResult.value = null
  } finally {
    validating.value = false
  }
}

let debounceTimer = null
watch(() => props.prompt, (newPrompt) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    performValidation(newPrompt)
  }, 800)
}, { immediate: true })
</script>

<style scoped lang="scss">
// Theme Variables - Fresh Blue/Slate Palette (NO PURPLE)
$primary-color: #0ea5e9; // Sky 500
$primary-dark: #0284c7;  // Sky 600
$success-color: #10b981; // Emerald 500
$warning-color: #f59e0b; // Amber 500
$error-color: #ef4444;   // Red 500
$slate-900: #0f172a;
$slate-700: #334155;
$slate-500: #64748b;
$slate-400: #94a3b8;
$slate-200: #e2e8f0;
$slate-50: #f8fafc;

.prompt-validator-container {
  margin-top: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

// --- Status Cards ---
.status-card {
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: #fff;
  border: 1px solid $slate-200;
  transition: all 0.3s ease;

  &.validating {
    padding: 6px 10px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-color: #bae6fd;
    box-shadow: 0 2px 6px rgba(14, 165, 233, 0.1);

    .scan-effect {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.5), transparent);
      transform: translateY(-100%);
      animation: scan-vertical 2s infinite ease-in-out;
      pointer-events: none;
    }

    .content-wrapper.compact-row {
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
      z-index: 1;

      .radar-spinner.small {
        width: 14px;
        height: 14px;
        position: relative;
        .circle {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid $primary-color;
          opacity: 0;
          animation: ripple 1.5s infinite cubic-bezier(0, 0.2, 0.8, 1);
          &:nth-child(2) { animation-delay: -0.5s; }
        }
      }

      .primary-text { 
        margin: 0; 
        font-size: 11px; 
        font-weight: 600; 
        color: $primary-dark; 
      }
    }
  }

  &.empty {
    padding: 8px 10px;
    display: flex;
    justify-content: center;
    background: $slate-50;
    border: 1px dashed $slate-200;

    .empty-content-row {
      display: flex;
      align-items: center;
      gap: 6px;
      color: $slate-500;

      .mini-icon {
        font-size: 14px;
        color: $slate-400;
      }
      
      span { font-size: 11px; font-weight: 500; }
    }
  }
}

// --- Result Container ---
.result-container {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .status-header {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid transparent;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    gap: 8px;
    transition: all 0.3s ease;

    .status-icon {
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-info {
      flex: 1;
      .status-title { font-weight: 700; font-size: 11px; color: $slate-900; margin-bottom: 2px; }
      .status-desc { font-size: 10px; opacity: 0.85; line-height: 1.3; }
    }

    &.is-success {
      background: #ecfdf5; border-color: #a7f3d0;
      .status-icon { color: $success-color; }
      .status-info { color: #065f46; }
    }
    &.is-warning {
      background: #fffbeb; border-color: #fde68a;
      .status-icon { color: $warning-color; }
      .status-info { color: #92400e; }
    }
    &.is-error {
      background: #fef2f2; border-color: #fecaca;
      .status-icon { color: $error-color; }
      .status-info { color: #991b1b; }
    }
  }

  .issues-panel {
    border-radius: 8px;
    border: 1px solid $slate-200;
    background: #fff;
    overflow: hidden;

    .issue-section {
      padding: 8px;
      border-bottom: 1px solid $slate-50;
      &:last-child { border-bottom: none; }

      .section-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 4px;
        &.text-error { color: $error-color; }
        &.text-warning { color: $warning-color; }
      }

      .issue-list {
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          position: relative;
          padding-left: 14px;
          font-size: 11px;
          color: $slate-500;
          line-height: 1.5;
          margin-bottom: 4px;

          &:last-child { margin-bottom: 0; }

          .bullet {
            position: absolute;
            left: 0;
            top: 6px;
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: currentColor;
            opacity: 0.5;
          }
        }
      }
    }
  }
}

// --- Animations ---
@keyframes scan-vertical {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(200%); }
}

@keyframes ripple {
  0% { transform: scale(0.1); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.mr-1 { margin-right: 4px; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
</style>
