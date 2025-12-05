<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Moon, Sun, CircleHelp } from 'lucide-vue-next';
import Modal from '../ui/Modal.vue';

// Dark Mode Logic
const isDark = ref(false);
const showHelp = ref(false);

onMounted(() => {
  // Check system or local storage
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  } else {
    isDark.value = false;
    document.documentElement.classList.remove('dark');
  }
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    localStorage.theme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.theme = 'light';
  }
};
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
    <!-- Sticky Header -->
    <header class="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <!-- Logo -->
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded bg-gradient-to-br from-brand-purple to-brand-green flex items-center justify-center text-white font-bold font-heading">
                C
            </div>
            <span class="font-bold text-xl tracking-tight text-gray-900 dark:text-white font-heading">Copyx</span>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-2">
            <button 
                @click="showHelp = true"
                class="p-2 rounded-full text-gray-500 hover:text-brand-purple dark:text-gray-400 dark:hover:text-brand-green transition-colors"
                aria-label="Help"
            >
                <CircleHelp class="w-5 h-5" />
            </button>
            <button 
                @click="toggleTheme" 
                class="p-2 rounded-full text-gray-500 hover:text-brand-purple dark:text-gray-400 dark:hover:text-brand-green transition-colors"
                aria-label="Toggle Dark Mode"
            >
                <Moon v-if="!isDark" class="w-5 h-5" />
                <Sun v-else class="w-5 h-5" />
            </button>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <slot></slot>
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <p>&copy; {{ new Date().getFullYear() }} Copyx. All rights reserved.</p>
            <div class="flex gap-4 mt-2 md:mt-0">
                <a href="#" class="hover:text-brand-purple transition-colors">Privacy Policy</a>
                <a href="#" class="hover:text-brand-purple transition-colors">Terms of Service</a>
                <span>v1.0.0</span>
            </div>
        </div>
    </footer>

    <!-- Help Modal -->
    <Modal :show="showHelp" title="How to use Copyx" @close="showHelp = false">
        <div class="space-y-4 text-gray-600 dark:text-gray-300">
            <p>Copyx generates standard IKEA receipts from CMR transport documents securely in your browser.</p>
            
            <div class="space-y-2">
                <h4 class="font-bold text-gray-900 dark:text-white">Instructions:</h4>
                <ol class="list-decimal list-inside space-y-1 ml-1">
                    <li>Drag and drop your <strong>CMR PDF</strong> files into the drop zone.</li>
                    <li>Wait for the secure local processing to complete.</li>
                    <li>Review the generated receipts in the list.</li>
                    <li>Click <strong>Download All</strong> to get a ZIP package with all receipts.</li>
                </ol>
            </div>

            <div class="p-3 bg-brand-purple/10 border border-brand-purple/20 rounded text-sm text-brand-purple dark:text-purple-300">
                <strong>Privacy Note:</strong> All processing happened locally on your device. No documents were uploaded to any server.
            </div>
        </div>
    </Modal>
  </div>
</template>

<style scoped>
.font-heading {
  font-family: 'Outfit', sans-serif;
}
</style>
