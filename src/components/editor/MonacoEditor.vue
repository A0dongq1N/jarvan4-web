<template>
  <div ref="editorEl" class="monaco-editor-wrapper"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { registerTencentTheme } from '@/utils/monaco'

const props = withDefaults(defineProps<{
  modelValue?: string
  language?: string
  readonly?: boolean
  theme?: string
}>(), {
  modelValue: '',
  language: 'go',
  readonly: false,
  theme: 'tencentLight',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': [value: string]
}>()

const editorEl = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(async () => {
  await nextTick()
  if (!editorEl.value) return

  registerTencentTheme(monaco)

  editor = monaco.editor.create(editorEl.value, {
    value: props.modelValue,
    language: props.language,
    theme: props.theme,
    readOnly: props.readonly,
    fontSize: 14,
    lineHeight: 22,
    tabSize: 4,
    insertSpaces: false,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    renderLineHighlight: 'all',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    bracketPairColorization: { enabled: true },
    padding: { top: 12, bottom: 12 },
  })

  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue())
  })

  // Ctrl+S save
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    emit('save', editor!.getValue())
  })
})

watch(() => props.modelValue, (val) => {
  if (editor && editor.getValue() !== val) {
    editor.setValue(val)
  }
})

watch(() => props.language, (lang) => {
  if (editor) {
    const model = editor.getModel()
    if (model) monaco.editor.setModelLanguage(model, lang)
  }
})

onUnmounted(() => {
  editor?.dispose()
  editor = null
})
</script>

<style scoped>
.monaco-editor-wrapper {
  width: 100%;
  height: 100%;
  min-height: 300px;
  overflow: hidden;
  border-radius: 4px;
}
</style>
