<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  CheckCircle2,
  Download,
  Loader2,
  ChevronDown,
  Search,
  RefreshCw,
  Trash2,
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
  downloadingLanguageCode,
  isDownloaded,
  downloadLanguagePack,
  changeLanguage,
  reloadCurrentLanguage,
  removeLanguagePack,
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

async function handleRowClick(langCode: string) {
  const norm = langCode.toLowerCase();
  if (norm === currentLanguage.value.toLowerCase()) {
    isOpen.value = false;
    return;
  }

  // If not downloaded yet, clicking the row downloads and applies it
  if (!isDownloaded(norm)) {
    await changeLanguage(langCode);
  } else {
    await changeLanguage(langCode);
    isOpen.value = false;
  }
}

async function handleDownloadClick(langCode: string) {
  await downloadLanguagePack(langCode);
}

function handleDeletePack(langCode: string) {
  removeLanguagePack(langCode);
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

      <!-- Translating Indicator in Trigger -->
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
        class="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden text-xs"
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
        <div class="max-h-72 overflow-y-auto p-1.5 divide-y divide-gray-50 dark:divide-gray-800/50">
          <div
            v-for="lang in filteredLanguages"
            :key="lang.code"
            @click="handleRowClick(lang.code)"
            class="group w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/60"
            :class="
              currentLanguage.toLowerCase() === lang.code.toLowerCase()
                ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple dark:text-purple-300 font-semibold'
                : 'text-gray-700 dark:text-gray-200'
            "
          >
            <!-- Left: Flag & Names -->
            <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
              <span class="text-lg leading-none shrink-0">{{ lang.flag }}</span>
              <div class="min-w-0 truncate">
                <div class="flex items-center gap-1.5">
                  <span class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ lang.nativeName }}</span>
                  <span
                    v-if="currentLanguage.toLowerCase() === lang.code.toLowerCase()"
                    class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand-purple/20 text-brand-purple dark:text-purple-300 shrink-0"
                  >
                    {{ t('common.active') }}
                  </span>
                </div>
                <span class="text-[11px] text-gray-400 dark:text-gray-400 truncate block">({{ lang.name }})</span>
              </div>
            </div>

            <!-- Right: Fixed & Pinned to the right edge -->
            <div class="ml-auto shrink-0 flex items-center justify-end min-w-[76px]" @click.stop>
              <!-- STATE 2: DOWNLOADING (Spinner + Progress) -->
              <template v-if="downloadingLanguageCode === lang.code.toLowerCase()">
                <span class="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-brand-purple dark:text-purple-300 bg-brand-purple/10 dark:bg-brand-purple/25 px-2 py-0.5 rounded-full animate-pulse">
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                  <span>{{ translationProgress }}%</span>
                </span>
              </template>

              <!-- STATE 1: DOWNLOADED (Green Checkmark) -->
              <template v-else-if="isDownloaded(lang.code)">
                <div class="flex items-center gap-1.5 justify-end">
                  <span
                    class="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"
                    :title="t('common.downloaded')"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
                    <span>{{ t('common.downloaded') }}</span>
                  </span>

                  <!-- Delete pack button (only for non-English cached languages) -->
                  <button
                    v-if="lang.code.toLowerCase() !== 'en'"
                    @click.stop="handleDeletePack(lang.code)"
                    class="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity"
                    :title="t('common.deletePack')"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </template>

              <!-- STATE 3: NOT DOWNLOADED (Download button pinned to the right) -->
              <template v-else>
                <button
                  @click.stop="handleDownloadClick(lang.code)"
                  class="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:text-brand-purple dark:hover:text-purple-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 transition-colors shadow-2xs"
                  :title="t('common.download')"
                >
                  <Download class="w-3 h-3 text-brand-purple dark:text-purple-300" />
                  <span>{{ t('common.download') }}</span>
                </button>
              </template>
            </div>
          </div>

          <div
            v-if="filteredLanguages.length === 0"
            class="py-6 text-center text-gray-400 text-xs"
          >
            No language found matching "{{ searchQuery }}"
          </div>
        </div>

        <!-- Translation Info Footer -->
        <div class="p-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <div class="flex items-center gap-1.5 font-medium">
            <span>{{ t('common.poweredByGoogle') }}</span>
          </div>

          <button
            v-if="currentLanguage.toLowerCase() !== 'en'"
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
