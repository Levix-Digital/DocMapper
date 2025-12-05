<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
});

const baseClasses = "px-4 py-2 rounded font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-purple/50";

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return "bg-white dark:bg-gray-900 border border-brand-purple/30 text-gray-900 dark:text-white hover:shadow-[0_0_10px_rgba(147,51,234,0.3)] hover:border-brand-purple relative overflow-hidden group";
    case 'secondary':
      return "bg-transparent border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-green hover:text-brand-green";
    case 'ghost':
      return "bg-transparent text-gray-500 hover:text-brand-purple dark:text-gray-400";
    default:
      return "";
  }
});
</script>

<template>
  <button :class="[baseClasses, variantClasses, { 'opacity-50 cursor-not-allowed': disabled }]" :disabled="disabled">
    <!-- LED Effect for Primary -->
    <span v-if="variant === 'primary'" class="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-brand-purple to-brand-green scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></span>
    
    <slot name="icon"></slot>
    <slot></slot>
  </button>
</template>
