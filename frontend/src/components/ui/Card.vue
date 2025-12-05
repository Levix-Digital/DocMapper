<script setup lang="ts">
defineProps<{
  hoverEffect?: boolean;
}>();
</script>

<template>
  <div 
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-all duration-300"
    :class="{ 'hover:border-brand-purple hover:shadow-lg dark:hover:border-brand-green': hoverEffect }"
  >
    <slot></slot>
  </div>
</template>
