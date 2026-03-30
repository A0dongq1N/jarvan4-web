import type * as monaco from 'monaco-editor'

// tencentLight 主题定义
export const tencentLightTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '86909c', fontStyle: 'italic' },
    { token: 'keyword', foreground: '006EFF', fontStyle: 'bold' },
    { token: 'string', foreground: '00a870' },
    { token: 'number', foreground: 'e54545' },
    { token: 'type', foreground: '7c4dff' },
    { token: 'function', foreground: '0050b3' },
    { token: 'variable', foreground: '1d2129' },
    { token: 'operator', foreground: 'ff6b35' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1d2129',
    'editorLineNumber.foreground': '#c9cdd4',
    'editorLineNumber.activeForeground': '#006EFF',
    'editor.lineHighlightBackground': '#f5f7fa',
    'editor.selectionBackground': '#cce6ff',
    'editorCursor.foreground': '#006EFF',
    'editorIndentGuide.background1': '#f2f3f5',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#e5e6eb',
  },
}

export function registerTencentTheme(monacoInstance: typeof monaco) {
  monacoInstance.editor.defineTheme('tencentLight', tencentLightTheme)
}
