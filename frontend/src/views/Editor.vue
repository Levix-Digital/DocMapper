<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <!-- Header Section -->
    <div class="text-center space-y-2">
      <h1 class="text-4xl font-bold font-heading text-gray-900 dark:text-white">Document Processor</h1>
      <p class="text-gray-500 dark:text-gray-400">Secure, client-side batch document processing. Zero cloud upload.</p>
    </div>

    <!-- Profile Selector Card -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="flex items-center gap-3 w-full sm:w-auto">
        <div class="p-2 rounded-xl bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-purple-300">
          <Layers class="w-5 h-5" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400">
            Active Processing Profile
          </label>
          <select
            v-model="selectedProfileId"
            class="mt-0.5 bg-transparent font-bold text-gray-900 dark:text-white text-sm focus:outline-none cursor-pointer"
          >
            <option
              v-for="prof in availableProfiles"
              :key="prof.id"
              :value="prof.id"
              class="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              {{ prof.name }} ({{ prof.fields.length }} fields)
            </option>
          </select>
        </div>
      </div>

      <button
        @click="navigate('mapping')"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all w-full sm:w-auto justify-center"
      >
        <Sliders class="w-3.5 h-3.5 text-brand-purple" />
        <span>Customize in Mapping Studio</span>
      </button>
    </div>

    <!-- Drag & Drop Area -->
    <Card 
      class="relative border-2 border-dashed transition-all duration-300 group cursor-pointer"
      :class="[
        isDragging ? 'border-brand-purple bg-brand-purple/5' : 'border-gray-300 dark:border-gray-700',
        isProcessing ? 'animate-led-border border-transparent' : ''
      ]"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="application/pdf,.pdf"
        class="hidden"
        @change="handleFileSelect"
      />
      
      <div class="py-16 flex flex-col items-center justify-center text-center space-y-4">
        <!-- Icon State -->
        <div class="relative">
          <div v-if="isProcessing" class="absolute -inset-4 bg-gradient-to-r from-brand-purple to-brand-green rounded-full blur-lg opacity-50 animate-pulse"></div>
          <div class="relative bg-white dark:bg-gray-800 p-4 rounded-full shadow-lg">
            <Loader2 v-if="isProcessing" class="w-8 h-8 text-brand-purple animate-spin" />
            <UploadCloud v-else class="w-8 h-8 text-gray-400 group-hover:text-brand-purple transition-colors" />
          </div>
        </div>

        <!-- Text State -->
        <div class="space-y-1">
            <div v-if="isProcessing">
                <p class="text-xl font-medium text-gray-900 dark:text-white">Processing Files...</p>
                <p class="text-sm text-gray-500">{{ progressText || 'Executing client-side extraction...' }}</p>
            </div>
            <div v-else>
                <p class="text-xl font-medium text-gray-900 dark:text-white">Drop PDF files here</p>
                <p class="text-sm text-gray-500">or click to browse filesystem</p>
            </div>
        </div>
      </div>
    </Card>

    <!-- Error Message -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <p>{{ error }}</p>
    </div>

    <!-- Results Section -->
    <div v-if="displayResults.length > 0" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="flex justify-between items-end border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Output Stream</h2>
          <p class="text-sm text-gray-500">{{ displayResults.length }} documents generated</p>
        </div>
        <Button variant="primary" @click="downloadAll">
            <template #icon><Download class="w-4 h-4" /></template>
            Download All (ZIP)
        </Button>
      </div>

      <div class="grid gap-3">
        <Card 
            v-for="res in displayResults" 
            :key="res.fileName" 
            class="flex flex-col sm:flex-row justify-between sm:items-center gap-3 group !p-4 hover:border-brand-green"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-brand-green flex-shrink-0">
                <FileCheck class="w-5 h-5" />
            </div>
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ res.fileName }}</p>
              
              <!-- Field Snippets -->
              <div class="flex flex-wrap gap-2 text-xs text-gray-500 font-mono mt-1">
                <span v-for="(val, key) in getSnippetEntries(res.extractedData)" :key="key">
                  {{ key }}: {{ val }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-3 self-end sm:self-auto">
            <!-- Confidence Badge -->
            <span
              v-if="res.confidence !== undefined"
              class="px-2.5 py-1 rounded-full text-xs font-semibold"
              :class="[
                res.confidence >= 90
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : res.confidence >= 60
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
              ]"
            >
              {{ res.confidence }}% Confidence
            </span>

            <!-- Preview in Tab -->
            <button
              v-if="res.blob"
              @click="previewDocument(res.blob)"
              class="p-2 rounded-lg text-gray-500 hover:text-brand-purple hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Preview generated PDF"
            >
              <ExternalLink class="w-4 h-4" />
            </button>

            <!-- Download Single -->
            <Button variant="ghost" @click="downloadOne(res)">
              <Download class="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  UploadCloud,
  FileCheck,
  Download,
  Loader2,
  AlertCircle,
  Layers,
  Sliders,
  ExternalLink
} from 'lucide-vue-next';

import Card from '../components/ui/Card.vue';
import Button from '../components/ui/Button.vue';
import { getAllProfiles, BUILTIN_CMR_PROFILE_ID, createBuiltinCmrProfile } from '../services/mapping/profile-store';
import { executeBatchMapping } from '../services/mapping/mapping-runner';
import type { MappingProfile } from '../types/mapping';
import { useRouter } from '../composables/useRouter';

// Set worker source using Vite's ?url import
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const { navigate } = useRouter();

interface UnifiedResultItem {
  fileName: string;
  blob?: Blob;
  confidence?: number;
  extractedData: Record<string, string>;
}

const isProcessing = ref(false);
const isDragging = ref(false);
const error = ref<string | null>(null);
const progressText = ref('');
const displayResults = ref<UnifiedResultItem[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const availableProfiles = ref<MappingProfile[]>([]);
const selectedProfileId = ref<string>(BUILTIN_CMR_PROFILE_ID);

onMounted(() => {
  availableProfiles.value = getAllProfiles();
  if (availableProfiles.value.length > 0 && !availableProfiles.value.some(p => p.id === selectedProfileId.value)) {
    selectedProfileId.value = availableProfiles.value[0].id;
  }
});

const activeProfile = computed(() => {
  return availableProfiles.value.find(p => p.id === selectedProfileId.value) || availableProfiles.value[0];
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files) processFiles(Array.from(files));
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files) processFiles(Array.from(files));
};

function getSnippetEntries(data: Record<string, string>): Record<string, string> {
  const entries: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('field-') || !v) continue;
    entries[k] = v;
    count++;
    if (count >= 4) break;
  }
  return entries;
}

const processFiles = async (files: File[]) => {
  isProcessing.value = true;
  error.value = null;
  displayResults.value = [];
  progressText.value = '';

  try {
    const validFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (validFiles.length === 0) throw new Error("Please upload valid PDF files (.pdf).");

    const profile = activeProfile.value || createBuiltinCmrProfile();
    const results = await executeBatchMapping({
      files: validFiles,
      profile,
      onProgress: (done, total, name) => {
        progressText.value = `Processing ${done + 1}/${total}: ${name}`;
      },
    });

    for (const res of results) {
      if (res.status === 'APPROVED' && res.pdfBlob) {
        displayResults.value.push({
          fileName: res.fileName,
          blob: res.pdfBlob,
          confidence: res.overallConfidence,
          extractedData: res.extractedData,
        });
      }
    }

    if (displayResults.value.length === 0) {
      error.value = "Extraction completed, but no documents matched the profile with sufficient confidence. Please check field mappings in Mapping Studio.";
    }
  } catch (err: any) {
    console.error("Batch processing error:", err);
    error.value = err.message || "An error occurred while processing files.";
  } finally {
    isProcessing.value = false;
    if (fileInput.value) fileInput.value.value = ''; 
  }
};

const previewDocument = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

const downloadOne = (res: UnifiedResultItem) => {
  if (res.blob) {
    saveAs(res.blob, res.fileName);
  }
};

const downloadAll = async () => {
  const zip = new JSZip();
  displayResults.value.forEach(res => {
    if (res.blob) {
      zip.file(res.fileName, res.blob);
    }
  });
  
  // Build dynamic CSV summary from extracted data fields
  const allFieldKeys = Array.from(
    new Set(
      displayResults.value.flatMap(r =>
        Object.keys(r.extractedData).filter(k => !k.startsWith('field-'))
      )
    )
  );

  const csvHeader = allFieldKeys.join(',') + '\n';
  const csvRows = displayResults.value.map(r => {
    return allFieldKeys
      .map(k => `"${(r.extractedData[k] || '').replace(/"/g, '""')}"`)
      .join(',');
  }).join('\n');

  zip.file("summary.csv", csvHeader + csvRows);

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "documents.zip");
};
</script>
