<template>
  <div />
</template>

<script setup lang="ts">
// 此页面已废弃，脚本通过 Git 仓库管理，不再支持页面编辑
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
onMounted(() => router.replace('/script'))
</script>
