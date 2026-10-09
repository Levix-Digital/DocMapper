<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Moon, Sun, CircleHelp, FileText, Layers } from 'lucide-vue-next';
import Modal from '../ui/Modal.vue';
import LanguagePicker from '../common/LanguagePicker.vue';
import { useRouter } from '../../composables/useRouter';
import { useI18n } from '../../i18n';

// Dark Mode Logic
const isDark = ref(false);
const showHelp = ref(false);

const { currentRoute, navigate } = useRouter();
const { t } = useI18n();

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
        <a href="#/" @click.prevent="navigate('processor')" class="flex items-center gap-2">
            <div class="w-8 h-8 rounded bg-gradient-to-br from-brand-purple to-brand-green flex items-center justify-center text-white font-bold font-heading">
                D
            </div>
            <span class="font-bold text-xl tracking-tight text-gray-900 dark:text-white font-heading">DocMapper</span>
        </a>

        <!-- Center Nav Tabs -->
        <nav class="flex items-center gap-1 sm:gap-2 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl">
          <button 
            @click="navigate('processor')"
            :class="currentRoute === 'processor' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            id="nav-processor"
          >
            <FileText class="w-4 h-4" />
            <span>{{ t('nav.processor') }}</span>
          </button>
          <button 
            @click="navigate('mapping')"
            :class="currentRoute === 'mapping' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            id="nav-mapping"
          >
            <Layers class="w-4 h-4" />
            <span>{{ t('nav.mappingStudio') }}</span>
          </button>
        </nav>

        <!-- Controls -->
        <div class="flex items-center gap-2">
            <LanguagePicker />
            <button 
                @click="showHelp = true"
                class="p-2 rounded-full text-gray-500 hover:text-brand-purple dark:text-gray-400 dark:hover:text-brand-green transition-colors"
                :aria-label="t('nav.helpTitle')"
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
            <p>&copy; {{ new Date().getFullYear() }} Levix Digital. {{ t('nav.allRightsReserved') }}</p>
            <div class="flex gap-4 mt-2 md:mt-0">
                <a href="#" class="hover:text-brand-purple transition-colors">{{ t('nav.privacyPolicy') }}</a>
                <a href="#" class="hover:text-brand-purple transition-colors">{{ t('nav.termsOfService') }}</a>
                <span>v1.0.0</span>
            </div>
        </div>
    </footer>

    <!-- Help Modal -->
    <Modal :show="showHelp" :title="t('nav.helpTitle')" @close="showHelp = false">
        <div class="space-y-4 text-gray-600 dark:text-gray-300">
            <p>{{ t('nav.helpDesc') }}</p>
            
            <div class="space-y-2">
                <h4 class="font-bold text-gray-900 dark:text-white">{{ t('nav.instructions') }}</h4>
                <ol class="list-decimal list-inside space-y-1 ml-1">
                    <li>{{ t('nav.helpStep1') }}</li>
                    <li>{{ t('nav.helpStep2') }}</li>
                    <li>{{ t('nav.helpStep3') }}</li>
                    <li>{{ t('nav.helpStep4') }}</li>
                </ol>
            </div>

            <div class="p-3 bg-brand-purple/10 border border-brand-purple/20 rounded text-sm text-brand-purple dark:text-purple-300">
                {{ t('nav.privacyNote') }}
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
