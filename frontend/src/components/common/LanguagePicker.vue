<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  RefreshCw,
} from 'lucide-vue-next';
import { useI18n } from '../../i18n';
import type { LanguageOption } from '../../i18n/languages';

const {
  t,
  currentLanguage,
  currentLanguageOption,
  supportedLanguages,
  isTranslating,
  translationProgress,
  changeLanguage,
  reloadCurrentLanguage,
} = useI18n();

const isOpen = ref(false);
const searchQuery = ref('');
const pickerRef = ref<HTMLElement | null>(null);

const filteredLanguages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return supportedLanguages;
  return supportedLanguages.filter(
    (lang: LanguageOption) =>
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
  );
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
  }
}

async function selectLanguage(langCode: string) {
  isOpen.value = false;
  if (langCode === currentLanguage.value) return;
  await changeLanguage(langCode);
}

function handleClickOutside(event: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="pickerRef" class="relative inline-block text-left">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 shadow-sm transition-all focus:outline-none"
      :class="{ 'ring-2 ring-brand-purple/40': isOpen }"
      :title="t('common.language')"
    >
      <span class="text-base leading-none">{{ currentLanguageOption.flag }}</span>
      <span class="font-medium tracking-wide uppercase">{{ currentLanguageOption.code }}</span>

      <!-- Translating Indicator -->
      <span
        v-if="isTranslating"
        class="flex items-center gap-1 text-[10px] font-bold text-brand-purple dark:text-purple-300 bg-brand-purple/10 dark:bg-brand-purple/20 px-1.5 py-0.5 rounded-full animate-pulse"
      >
        <Loader2 class="w-2.5 h-2.5 animate-spin" />
        <span>{{ translationProgress }}%</span>
      </span>

      <ChevronDown
        class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- Dropdown Menu -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0 -translate-y-1"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden text-xs"
      >
        <!-- Header & Search Input -->
        <div class="p-2.5 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-800/90">
          <div class="relative flex items-center">
            <Search class="w-3.5 h-3.5 absolute left-2.5 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('common.searchLanguage')"
              class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-purple"
              autofocus
            />
          </div>
        </div>

        <!-- Languages List -->
        <div class="max-h-64 overflow-y-auto p-1 divide-y divide-transparent">
          <button
            v-for="lang in filteredLanguages"
            :key="lang.code"
            @click="selectLanguage(lang.code)"
            class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/60"
            :class="
              currentLanguage === lang.code
                ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple dark:text-purple-300 font-bold'
                : 'text-gray-700 dark:text-gray-200'
            "
          >
            <div class="flex items-center gap-2.5 truncate">
              <span class="text-lg leading-none">{{ lang.flag }}</span>
              <div class="truncate">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ lang.nativeName }}</span>
                <span class="ml-1.5 text-[11px] text-gray-400 dark:text-gray-400">({{ lang.name }})</span>
              </div>
            </div>

            <Check
              v-if="currentLanguage === lang.code"
              class="w-4 h-4 text-brand-purple dark:text-purple-300 shrink-0"
            />
          </button>

          <div
            v-if="filteredLanguages.length === 0"
            class="py-6 text-center text-gray-400 text-xs"
          >
            No language found matching "{{ searchQuery }}"
          </div>
        </div>

        <!-- Translation Info Footer -->
        <div class="p-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <div class="flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-brand-purple dark:text-purple-300" />
            <span>AI Runtime i18n</span>
          </div>

          <button
            v-if="currentLanguage !== 'en'"
            @click.stop="reloadCurrentLanguage"
            class="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-purple dark:hover:text-purple-300 transition-colors"
            title="Force refresh translations"
          >
            <RefreshCw class="w-2.5 h-2.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
