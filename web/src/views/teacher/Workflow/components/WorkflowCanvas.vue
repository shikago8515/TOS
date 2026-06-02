<template>
  <div 
    class="canvas-container" 
    @mousedown="$emit('panStart', $event)" 
    @mousemove="$emit('mouseMove', $event)" 
    @mouseup="$emit('mouseUp', $event)"
    @mouseleave="$emit('mouseLeave', $event)"
    @wheel="$emit('wheel', $event)"
    ref="canvasRef"
  >
    <div class="canvas-content" :style="canvasStyle">
      <div class="grid-background"></div>
      
      <!-- 连线层 -->
      <svg class="connections-layer">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
          </marker>
        </defs>
        <path 
          v-for="(conn, idx) in connections" 
          :key="idx" 
          :d="calculatePath(conn)" 
          class="connection-path"
          :class="{ selected: selectedConnection === conn }"
          marker-end="url(#arrowhead)"
          @click.stop="$emit('selectConnection', conn)"
          @dblclick.stop="$emit('deleteConnection', conn)"
        />
        <!-- 正在绘制的线 -->
        <path
          v-if="isDrawingConnection"
          :d="drawingPath"
          class="connection-path drawing"
          marker-end="url(#arrowhead)"
        />
      </svg>

      <!-- 节点层 -->
      <div 
        v-for="node in nodes" 
        :key="node.id"
        class="node"
        :class="[
          node.type, 
          { 
            selected: selectedNode?.id === node.id,
            running: node.status === 'running',
            success: node.status === 'success',
            error: hasError(node)
          }
        ]"
        :style="{ transform: `translate(${node.x}px, ${node.y}px)` }"
        @click.stop="$emit('selectNode', node)"
      >
        <!-- 错误提示 -->
        <el-tooltip 
          v-if="hasError(node)" 
          :content="getErrorMsg(node)" 
          placement="top" 
          effect="dark"
          :teleported="false"
        >
          <div class="error-badge">!</div>
        </el-tooltip>

        <!-- 输入端口（仅视觉展示） -->
        <div 
          class="port port-in" 
          v-if="node.type !== 'start-node'"
        ></div>
        
        <div class="node-header">
          <div class="node-icon">
            <el-icon><component :is="node.icon" /></el-icon>
          </div>
          <span class="node-title">{{ node.label }}</span>
        </div>
        <div class="node-body" v-if="node.type === 'agent-node'">
          <div class="model-badge">
            <el-icon class="badge-icon"><Cpu /></el-icon>
            {{ node.meta }}
          </div>
        </div>
        
        <!-- 输出端口（仅视觉展示） -->
        <div 
          class="port port-out" 
          v-if="node.type !== 'end-node'"
        ></div>
      </div>
    </div>

    <!-- 缩放控制 -->
    <div class="zoom-controls">
      <el-button-group>
        <el-button size="small" icon="Minus" @click="$emit('zoomOut')" />
        <el-button size="small" class="zoom-text">{{ Math.round(zoom * 100) }}%</el-button>
        <el-button size="small" icon="Plus" @click="$emit('zoomIn')" />
      </el-button-group>
      <el-button size="small" icon="FullScreen" class="fit-btn" @click="$emit('fitView')" title="适应屏幕" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { 
  VideoPlay, SwitchButton, Cpu, View, DataLine, Operation, 
  Minus, Plus, FullScreen,
  Search, EditPen, Collection, List, CircleCheck // Icons needed for nodes
} from '@element-plus/icons-vue'

const props = defineProps({
  nodes: Array,
  connections: Array,
  selectedNode: Object,
  selectedConnection: Object,
  zoom: Number,
  pan: Object,
  drawingPath: String,
  isDrawingConnection: Boolean,
  validationResults: Object // 🆕 验证结果
})

const emit = defineEmits([
  'panStart', 'mouseMove', 'mouseUp', 'mouseLeave', 'wheel',
  'selectConnection', 'selectNode',
  'zoomIn', 'zoomOut', 'fitView'
])

const canvasRef = ref(null)

// 检查节点是否有错误
const hasError = (node) => {
  if (!props.validationResults?.nodeResults) return false
  const result = props.validationResults.nodeResults[node.id]
  return result && !result.valid
}

// 获取节点错误信息
const getErrorMsg = (node) => {
  if (!hasError(node)) return ''
  const result = props.validationResults.nodeResults[node.id]
  return result.errors ? result.errors.join('; ') : '校验未通过'
}

const canvasStyle = computed(() => ({
  transform: `translate(${props.pan.x}px, ${props.pan.y}px) scale(${props.zoom})`,
  transformOrigin: '0 0'
}))

// 计算路径的辅助函数
const getPortPosition = (node, type) => {
  const isStartOrEnd = node.type === 'start-node' || node.type === 'end-node'
  const width = isStartOrEnd ? 140 : 240
  const portYOffset = isStartOrEnd ? 24 : 55 
  
  return {
    x: type === 'in' ? node.x : node.x + width,
    y: node.y + portYOffset
  }
}

const calculatePath = (conn) => {
  const sourceNode = props.nodes.find(n => n.id === conn.source)
  const targetNode = props.nodes.find(n => n.id === conn.target)
  if (!sourceNode || !targetNode) return ''

  const start = getPortPosition(sourceNode, 'out')
  const end = getPortPosition(targetNode, 'in')

  const dx = Math.abs(end.x - start.x)
  const cpOffset = Math.max(dx * 0.5, 50)

  return `M ${start.x} ${start.y} C ${start.x + cpOffset} ${start.y}, ${end.x - cpOffset} ${end.y}, ${end.x} ${end.y}`
}

defineExpose({ canvasRef })
</script>

<style scoped lang="scss">
$primary: #2563eb;
$success: #10b981;
$bg-canvas: #f8fafc;

.canvas-container {
  flex: 1;
  position: relative;
  background: $bg-canvas;
  overflow: hidden;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-tag) {
    font-size: 16px;
  }
  
  .canvas-content {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0; 
    left: 0;
    
    .grid-background {
      position: absolute;
      width: 50000px;
      height: 50000px;
      top: -25000px;
      left: -25000px;
      background-image: 
        radial-gradient(#cbd5e1 1.5px, transparent 1.5px),
        radial-gradient(#e2e8f0 1px, transparent 1px);
      background-size: 40px 40px, 10px 10px;
      opacity: 0.5;
      pointer-events: none;
    }
  }

  .connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    z-index: 10;

    .connection-path {
      fill: none;
      stroke: #94a3b8;
      stroke-width: 2;
      pointer-events: stroke;
      cursor: pointer;
      transition: stroke 0.2s;
      
      &:hover {
        stroke: $primary;
        stroke-width: 3;
      }
      
      &.selected {
        stroke: $primary;
        stroke-width: 3;
        marker-end: url(#arrowhead-selected);
      }
      
      &.drawing {
        stroke: $primary;
        stroke-dasharray: 5, 5;
        animation: dash 1s linear infinite;
      }
    }
  }

  .node {
    position: absolute;
    width: 240px;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 
       0 1px 3px 0 rgba(0, 0, 0, 0.1), 
       0 1px 2px -1px rgba(0, 0, 0, 0.06);
    z-index: 20;
    cursor: default;
    user-select: none;
    transition: all 0.2s ease;

    &:hover {
       box-shadow: 
         0 10px 15px -3px rgba(0, 0, 0, 0.1), 
         0 4px 6px -4px rgba(0, 0, 0, 0.1);
       z-index: 25;
       transform: translateY(-2px);
    }

    &.selected {
       border-color: $primary;
       box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    .node-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #f1f5f9;
      font-weight: 600;
      font-size: 16px;
      color: #334155;
      background: #f8fafc;
      border-radius: 12px 12px 0 0;
      cursor: pointer;
      
      .node-icon {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
    }

    .node-body {
      padding: 12px 16px;
      
      .model-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #eff6ff;
        color: $primary;
        font-size: 13px;
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 500;
        
        .badge-icon { font-size: 14px; }
      }
    }

    /* 端口样式 */
    .port {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #fff;
      border: 2px solid #94a3b8;
      position: absolute;
      z-index: 30;
    }
    .port-in { left: -7px; top: 55px; }
    .port-out { right: -7px; top: 55px; }

    /* 特殊类型适配 */
    &.start-node, &.end-node {
      width: 140px;
      .node-header { 
        justify-content: center; 
        background: transparent; 
        border: none; 
        padding: 12px;
        
        .node-icon { display: none; }
      }
      .port-in, .port-out { top: 22px; }
    }

    &.start-node {
      border-color: #10b981;
      background: #ecfdf5;
      .node-header { color: #059669; }
    }

    &.end-node {
      border-color: #ef4444;
      background: #fef2f2;
      .node-header { color: #dc2626; }
    }
    
    &.agent-node {
       .node-header .node-icon { color: $primary; }
    }

    &.running {
       border-color: $primary;
       animation: pulse 2s infinite;
    }
    
    &.success::after {
         content: '✓';
         position: absolute;
         top: -8px; 
         right: -8px;
         width: 24px;
         height: 24px;
         background: $success;
         color: white;
         border-radius: 50%;
         display: flex;
         align-items: center;
         justify-content: center;
         font-size: 14px;
         font-weight: bold;
         box-shadow: 0 2px 4px rgba(0,0,0,0.1);
         border: 2px solid white;
    }

    &.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
    }

    .error-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      width: 24px;
      height: 24px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 40;
      animation: bounce 0.5s;
    }
  }

  .zoom-controls {
    position: absolute;
    bottom: 24px;
    left: 24px;
    background: #ffffff;
    padding: 4px;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    display: flex;
    gap: 8px;
    z-index: 100;
    
    .zoom-text {
      width: 50px; 
      text-align: center;
      pointer-events: none;
      font-size: 16px;
    }
  }
}

@keyframes dash {
  to { stroke-dashoffset: -10; }
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
  40% {transform: translateY(-6px);}
  60% {transform: translateY(-3px);}
}
</style>
