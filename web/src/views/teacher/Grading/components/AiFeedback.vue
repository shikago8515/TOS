<template>
  <div class="ai-feedback-markdown" v-html="renderedContent"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

const renderedContent = computed(() => {
  if (!props.content) return ''
  const rawHtml = marked.parse(props.content)
  return DOMPurify.sanitize(rawHtml)
})
</script>

<style lang="scss">
.ai-feedback-markdown {
  font-size: 15px;
  line-height: 1.7;
  color: #303133;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

  h1, h2, h3, h4 {
    margin-top: 24px;
    margin-bottom: 12px;
    font-weight: 600;
    color: #2c3e50;
    line-height: 1.4;
  }
  
  h1 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.1em; }

  p {
    margin-bottom: 16px;
    text-align: justify;
  }

  ul, ol {
    padding-left: 24px;
    margin-bottom: 16px;
  }

  li {
    margin-bottom: 6px;
  }
  
  strong {
    color: #000;
    font-weight: 600;
  }

  code {
    background-color: rgba(27,31,35,0.05);
    padding: 2px 5px;
    border-radius: 4px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.9em;
    color: #476582;
  }

  pre {
    background-color: #f6f8fa;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 16px;
    line-height: 1.5;
    
    code {
      background-color: transparent;
      padding: 0;
      color: #303133;
      font-size: 0.9em;
    }
  }

  blockquote {
    margin: 0 0 16px;
    padding: 12px 16px;
    background-color: #f8f9fa;
    border-left: 4px solid #42b983;
    color: #6a737d;
    
    p { margin-bottom: 0; }
  }
  
  hr {
    height: 1px;
    padding: 0;
    margin: 24px 0;
    background-color: #e1e4e8;
    border: 0;
  }
  
  table {
    border-spacing: 0;
    border-collapse: collapse;
    margin-bottom: 16px;
    width: 100%;
    
    th, td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    
    tr {
      background-color: #fff;
      border-top: 1px solid #c6cbd1;
      
      &:nth-child(2n) {
        background-color: #f6f8fa;
      }
    }
  }
}
</style>