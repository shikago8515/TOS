<template>
  <div class="koi-scroll-nav" :style="{ '--koi-scroll-nav-height': height }">
    <ElButton
      v-show="scrollable"
      class="koi-scroll-nav__button"
      :disabled="!canScrollPrev"
      circle
      :aria-label="prevAriaLabel"
      @click="scrollByPage(-1)"
    >
      <ElIcon><ArrowLeft /></ElIcon>
    </ElButton>

    <div ref="viewportRef" class="koi-scroll-nav__viewport" @scroll="updateScrollState" @wheel="handleWheel">
      <div ref="trackRef" class="koi-scroll-nav__track">
        <slot />
      </div>
    </div>

    <ElButton
      v-show="scrollable"
      class="koi-scroll-nav__button"
      :disabled="!canScrollNext"
      circle
      :aria-label="nextAriaLabel"
      @click="scrollByPage(1)"
    >
      <ElIcon><ArrowRight /></ElIcon>
    </ElButton>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElButton, ElIcon } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    height?: string
    activeSelector?: string
    wheelFactor?: number
    prevAriaLabel?: string
    nextAriaLabel?: string
  }>(),
  {
    height: '42px',
    activeSelector: '',
    wheelFactor: 1,
    prevAriaLabel: '向左滚动标签',
    nextAriaLabel: '向右滚动标签',
  },
)

const viewportRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const scrollable = ref(false)
const canScrollPrev = ref(false)
const canScrollNext = ref(false)
let resizeObserver: ResizeObserver | null = null

function updateScrollState(): void {
  const viewport = viewportRef.value
  if (!viewport) {
    return
  }

  const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  scrollable.value = maxScrollLeft > 1
  canScrollPrev.value = viewport.scrollLeft > 1
  canScrollNext.value = viewport.scrollLeft < maxScrollLeft - 1
}

function scrollToSelector(selector = props.activeSelector): void {
  const viewport = viewportRef.value
  const track = trackRef.value
  if (!viewport || !track || !selector) {
    return
  }

  const target = track.querySelector<HTMLElement>(selector)
  if (!target) {
    return
  }

  const targetLeft = target.offsetLeft
  const targetRight = targetLeft + target.offsetWidth
  const viewportLeft = viewport.scrollLeft
  const viewportRight = viewportLeft + viewport.clientWidth

  if (targetLeft < viewportLeft) {
    viewport.scrollTo({ left: Math.max(0, targetLeft - 12), behavior: 'smooth' })
  } else if (targetRight > viewportRight) {
    viewport.scrollTo({
      left: targetRight - viewport.clientWidth + 12,
      behavior: 'smooth',
    })
  }
}

function scrollByPage(direction: -1 | 1): void {
  const viewport = viewportRef.value
  if (!viewport) {
    return
  }

  viewport.scrollBy({
    left: direction * Math.max(160, viewport.clientWidth * 0.72),
    behavior: 'smooth',
  })
}

function handleWheel(event: WheelEvent): void {
  const viewport = viewportRef.value
  if (!viewport || !scrollable.value) {
    return
  }

  const delta = (event.deltaY + event.deltaX) * props.wheelFactor
  if (delta === 0) {
    return
  }

  event.preventDefault()
  viewport.scrollLeft += delta
  updateScrollState()
}

watch(
  () => props.activeSelector,
  async () => {
    await nextTick()
    updateScrollState()
    scrollToSelector()
  },
)

onMounted(async () => {
  await nextTick()
  updateScrollState()
  scrollToSelector()

  resizeObserver = new ResizeObserver(() => {
    updateScrollState()
    scrollToSelector()
  })

  if (viewportRef.value) {
    resizeObserver.observe(viewportRef.value)
  }
  if (trackRef.value) {
    resizeObserver.observe(trackRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  scrollToSelector,
  updateScrollState,
})
</script>

<style scoped>
.koi-scroll-nav {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  height: var(--koi-scroll-nav-height);
}

.koi-scroll-nav__button {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
}

.koi-scroll-nav__viewport {
  min-width: 0;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.koi-scroll-nav__viewport::-webkit-scrollbar {
  display: none;
}

.koi-scroll-nav__track {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: max-content;
  height: var(--koi-scroll-nav-height);
}
</style>
