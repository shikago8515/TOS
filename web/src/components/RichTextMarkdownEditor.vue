<template>
  <div class="rich-md-editor">
    <div class="toolbar">
      <el-button size="small" @click="wrap('**', '**')"><b>B</b></el-button>
      <el-button size="small" @click="wrap('*', '*')"><i>I</i></el-button>
      <el-button size="small" @click="prefixLine('# ')">H1</el-button>
      <el-button size="small" @click="prefixLine('## ')">H2</el-button>
      <el-button size="small" @click="prefixLine('- ')">列表</el-button>
      <el-button size="small" @click="insertTemplate">模板</el-button>
    </div>

    <el-input
      ref="inputRef"
      v-model="localValue"
      type="textarea"
      :rows="rows"
      :placeholder="placeholder"
      resize="none"
      @input="handleInput"
    />

    <div class="tips">支持 Markdown 样式：标题、列表、加粗、斜体。</div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  rows: { type: Number, default: 8 },
  placeholder: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref()
const localValue = ref(props.modelValue || '')

watch(() => props.modelValue, (val) => {
  if (val !== localValue.value) {
    localValue.value = val || ''
  }
})

const handleInput = (val) => {
  emit('update:modelValue', val)
}

const getTextarea = () => {
  return inputRef.value?.textarea || null
}

const wrap = (left, right) => {
  const textarea = getTextarea()
  if (!textarea) return
  const start = textarea.selectionStart || 0
  const end = textarea.selectionEnd || 0
  const text = localValue.value || ''
  const selected = text.slice(start, end)
  const replaced = `${left}${selected || '文本'}${right}`
  localValue.value = text.slice(0, start) + replaced + text.slice(end)
  emit('update:modelValue', localValue.value)
}

const prefixLine = (prefix) => {
  const textarea = getTextarea()
  if (!textarea) return
  const start = textarea.selectionStart || 0
  const text = localValue.value || ''
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  localValue.value = text.slice(0, lineStart) + prefix + text.slice(lineStart)
  emit('update:modelValue', localValue.value)
}

const insertTemplate = () => {
  const tpl = '\n## 背景\n- 业务场景：\n- 核心目标：\n\n## 关键约束\n- \n\n## 输出要求\n- '
  localValue.value = `${localValue.value || ''}${tpl}`
  emit('update:modelValue', localValue.value)
}
</script>

<style scoped>
.rich-md-editor { display: flex; flex-direction: column; gap: 8px; }
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
.tips { font-size: 12px; color: #64748b; }
</style>
