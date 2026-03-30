<template>
  <div ref="diffEl" class="diff-editor-wrapper"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { registerTencentTheme } from '@/utils/monaco'

const props = withDefaults(defineProps<{
  original?: string
  modified?: string
  language?: string
}>(), {
  original: '',
  modified: '',
  language: 'go',
})

const diffEl = ref<HTMLElement | null>(null)
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null

onMounted(async () => {
  await nextTick()
  if (!diffEl.value) return

  registerTencentTheme(monaco)

  diffEditor = monaco.editor.createDiffEditor(diffEl.value, {
    theme: 'tencentLight',
    readOnly: true,
    fontSize: 13,
    lineHeight: 21,
    minimap: { enabled: false },
    renderSideBySide: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
  })

  updateModels()
})

function updateModels() {
  if (!diffEditor) return
  const originalModel = monaco.editor.createModel(props.original, props.language)
  const modifiedModel = monaco.editor.createModel(props.modified, props.language)
  diffEditor.setModel({ original: originalModel, modified: modifiedModel })
}

watch([() => props.original, () => props.modified], () => {
  updateModels()
})

onUnmounted(() => {
  diffEditor?.dispose()
  diffEditor = null
})
</script>

<style scoped>
.diff-editor-wrapper {
  width: 100%;
  height: 100%;
  min-height: 400px;
  overflow: hidden;
}
</style>
