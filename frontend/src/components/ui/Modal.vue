<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { onMounted, onUnmounted } from 'vue';

defineProps<{
  show: boolean;
  title?: string;
}>();

const emit = defineEmits(['close']);

const closeOnEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close');
};

onMounted(() => document.addEventListener('keydown', closeOnEscape));
onUnmounted(() => document.removeEventListener('keydown', closeOnEscape));
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" @click.self="$emit('close')">
      
      <Transition
        enter-active-class="transition duration-300 ease-out delay-100"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div v-if="show" class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 class="font-bold text-lg text-gray-900 dark:text-white font-heading">{{ title }}</h3>
                <button @click="$emit('close')" class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6">
                <slot></slot>
            </div>
        </div>
      </Transition>

    </div>
  </Transition>
</template>
