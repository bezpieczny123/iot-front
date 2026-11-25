<script setup lang="ts">
defineProps<{ label: string; value: string | number; unit?: string; detail?: string }>()
</script>

<template>
  <div class="p">
    <div class="lb">{{ label }}</div>
    <div class="big">{{ value }}<small v-if="unit">{{ unit }}</small></div>
    <div v-if="detail" class="sub">{{ detail }}</div>
  </div>
</template>
