<script setup lang="ts">
import { ref, shallowRef, markRaw, toRaw, onMounted, computed } from 'vue';
import {
  Upload,
  Save,
  Download,
  FolderOpen,
  CheckCircle,
  FileText,
  FileCheck,
  AlertCircle,
  Eye,
  ExternalLink,
  FileSignature,
  Tag,
  RotateCcw
} from 'lucide-vue-next';
import type { MappingProfile, FieldDefinition, BoundingBox, DestinationFieldMapping } from '../types/mapping';
import {
  saveProfile,
  createEmptyProfile,
  exportProfileAsDocMapper
} from '../services/mapping/profile-store';
import { formatOutputFileName } from '../services/mapping/filename-formatter';
import { loadPdf, extractTextInBox, isPageScanned } from '../services/pdf/spatial-extractor';
import { generateValidationPattern } from '../services/llm/gemini-service';
import { stampDestinationPdf } from '../services/pdf/dynamic-stamper';
import InteractivePdfCanvas from '../components/mapping/InteractivePdfCanvas.vue';
import FieldListDrawer from '../components/mapping/FieldListDrawer.vue';
import DestinationPlacementCanvas from '../components/mapping/DestinationPlacementCanvas.vue';
import ProfileManagementModal from '../components/mapping/ProfileManagementModal.vue';
import { useI18n } from '../i18n';

const { t } = useI18n();
const activeTab = ref<'origin' | 'destination' | 'preview'>('origin');

// Active Profile: 100% empty by default on startup
const currentProfile = ref<MappingProfile>(createEmptyProfile());
const editingProfileId = ref<string | null>(null);
const selectedFieldId = ref<string | null>(null);
const activeDrawingType = ref<'value' | 'label' | 'none'>('none');

// Origin PDF Sample
const samplePdfBytes = ref<Uint8Array | null>(null);
const samplePdfDoc = shallowRef<any | null>(null);
const sampleFileName = ref<string>('');
const isOriginScannedWarning = ref(false);

// AI Generating status
const isAiGenerating = ref(false);
const aiError = ref<string | null>(null);

// Modal state
const showProfileHub = ref(false);
const toastMessage = ref<string | null>(null);

// Preview PDF Blob
const previewPdfBlobUrl = ref<string | null>(null);
const isGeneratingPreview = ref(false);

onMounted(() => {
  // App opens 100% empty - no default profiles or documents preloaded
  clearStudioToEmpty();
});

function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = null;
  }, 3500);
}

const activeField = computed(() => {
  return currentProfile.value.fields.find(f => f.id === selectedFieldId.value) || null;
});

// Origin PDF Upload
async function handleOriginUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    samplePdfBytes.value = new Uint8Array(arrayBuffer);
    sampleFileName.value = file.name;
    const loaded = await loadPdf(samplePdfBytes.value);
    samplePdfDoc.value = markRaw(loaded);

    // Check if scanned
    const rawPdf = toRaw(samplePdfDoc.value);
    const firstPage = await rawPdf.getPage(1);
    isOriginScannedWarning.value = await isPageScanned(firstPage);

    // Extract all existing mapped fields from sample
    await extractAllSampleFields();
    showToast(t('nav.loadedToast', { name: file.name }));
  } catch (err: any) {
    alert(`Failed to parse sample PDF: ${err?.message || err}`);
  }
}

// Extract sample text for all fields
async function extractAllSampleFields() {
  const rawPdf = toRaw(samplePdfDoc.value);
  if (!rawPdf) return;

  for (const field of currentProfile.value.fields) {
    if (field.valueBox) {
      const pageNum = Math.min(Math.max(field.valueBox.page, 1), rawPdf.numPages);
      const page = await rawPdf.getPage(pageNum);
      const text = await extractTextInBox(page, field.valueBox);
      field.sampleExtractedValue = text;
    }
    if (field.labelBox) {
      const pageNum = Math.min(Math.max(field.labelBox.page, 1), rawPdf.numPages);
      const page = await rawPdf.getPage(pageNum);
      field.anchorText = await extractTextInBox(page, field.labelBox);
    }
  }
  saveCurrentProfile();
}

// Box drawn on origin canvas
async function onBoxDrawn(box: BoundingBox, type: 'value' | 'label') {
  if (!selectedFieldId.value) return;

  const field = currentProfile.value.fields.find(f => f.id === selectedFieldId.value);
  if (!field) return;

  const rawPdf = toRaw(samplePdfDoc.value);
  if (type === 'value') {
    field.valueBox = box;
    if (rawPdf) {
      const page = await rawPdf.getPage(box.page);
      field.sampleExtractedValue = await extractTextInBox(page, box);
    }
  } else {
    field.labelBox = box;
    if (rawPdf) {
      const page = await rawPdf.getPage(box.page);
      field.anchorText = await extractTextInBox(page, box);
    }
  }

  activeDrawingType.value = 'none'; // reset drawing mode
  saveCurrentProfile();
}

function onUpdateBox(fieldId: string, type: 'value' | 'label', box: BoundingBox) {
  const field = currentProfile.value.fields.find(f => f.id === fieldId);
  if (!field) return;

  const rawPdf = toRaw(samplePdfDoc.value);
  if (type === 'value') {
    field.valueBox = box;
    if (rawPdf) {
      rawPdf.getPage(box.page).then(async (page: any) => {
        field.sampleExtractedValue = await extractTextInBox(page, box);
      });
    }
  } else {
    field.labelBox = box;
    if (rawPdf) {
      rawPdf.getPage(box.page).then(async (page: any) => {
        field.anchorText = await extractTextInBox(page, box);
      });
    }
  }
  saveCurrentProfile();
}

function onDeleteBox(fieldId: string, type: 'value' | 'label') {
  const field = currentProfile.value.fields.find(f => f.id === fieldId);
  if (!field) return;

  if (type === 'label') {
    field.labelBox = undefined;
    field.anchorText = undefined;
  } else if (type === 'value') {
    field.valueBox = undefined;
    field.sampleExtractedValue = undefined;
  }
  saveCurrentProfile();
}

// Drawer Events
function onAddField(field: FieldDefinition) {
  currentProfile.value.fields.push(field);
  selectedFieldId.value = field.id;
  activeDrawingType.value = 'value'; // Immediately prompt user to draw value box
  saveCurrentProfile();
}

function onRemoveField(id: string) {
  currentProfile.value.fields = currentProfile.value.fields.filter(f => f.id !== id);
  // Also remove destination mappings bound to this field
  currentProfile.value.destinationMappings = currentProfile.value.destinationMappings.filter(
    m => m.fieldId !== id
  );
  if (selectedFieldId.value === id) {
    selectedFieldId.value = currentProfile.value.fields[0]?.id || null;
  }
  saveCurrentProfile();
}

function onUpdateField(field: FieldDefinition) {
  const idx = currentProfile.value.fields.findIndex(f => f.id === field.id);
  if (idx >= 0) {
    currentProfile.value.fields[idx] = field;
    saveCurrentProfile();
  }
}

function setDrawingMode(fieldId: string, type: 'value' | 'label') {
  selectedFieldId.value = fieldId;
  activeDrawingType.value = type;
}

// AI Rule Generation
async function onGenerateRuleWithAi(fieldId: string) {
  const field = currentProfile.value.fields.find(f => f.id === fieldId);
  if (!field) return;

  aiError.value = null;
  if (!field.sampleExtractedValue) {
    aiError.value = 'Please enter or capture a sample value first.';
    return;
  }

  let labelText = '';
  const rawPdf = toRaw(samplePdfDoc.value);
  if (field.labelBox && rawPdf) {
    const page = await rawPdf.getPage(field.labelBox.page);
    labelText = await extractTextInBox(page, field.labelBox);
  }

  try {
    isAiGenerating.value = true;
    console.log('[DocMapper Gemini] Requesting rule inference for:', {
      fieldName: field.name,
      sampleValue: field.sampleExtractedValue,
      labelContext: labelText,
    });

    const result = await generateValidationPattern({
      fieldName: field.name,
      sampleValue: field.sampleExtractedValue,
      labelContext: labelText,
    });

    console.log('[DocMapper Gemini] Model response:', result);
    field.validationPattern = result.regex;
    field.dataType = result.dataType;
    saveCurrentProfile();
    showToast(`Regex rule successfully generated for "${field.name}": ${result.regex}`);
  } catch (err: any) {
    console.error('[DocMapper Gemini] Error generating rule:', err);
    aiError.value = err?.message || String(err);
  } finally {
    isAiGenerating.value = false;
  }
}

// Destination Canvas Events
function onUploadTemplate(bytes: Uint8Array, fileName: string) {
  // Convert to Base64
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  currentProfile.value.destinationTemplateBase64 = btoa(binary);
  currentProfile.value.destinationTemplateName = fileName;
  saveCurrentProfile();
  showToast(`Uploaded destination template: ${fileName}`);
}

function onAddDestinationMapping(mapping: DestinationFieldMapping) {
  currentProfile.value.destinationMappings.push(mapping);
  saveCurrentProfile();
}

function onUpdateDestinationMapping(mapping: DestinationFieldMapping) {
  const idx = currentProfile.value.destinationMappings.findIndex(m => m.id === mapping.id);
  if (idx >= 0) {
    currentProfile.value.destinationMappings[idx] = mapping;
    saveCurrentProfile();
  }
}

function onRemoveDestinationMapping(id: string) {
  currentProfile.value.destinationMappings = currentProfile.value.destinationMappings.filter(
    m => m.id !== id
  );
}

function saveCurrentProfile() {
  // In-memory edits only until user explicitly clicks Save Profile
}

function clearStudioToEmpty() {
  currentProfile.value = createEmptyProfile();
  editingProfileId.value = null;
  selectedFieldId.value = null;
  activeDrawingType.value = 'none';
  samplePdfBytes.value = null;
  samplePdfDoc.value = null;
  sampleFileName.value = '';
  isOriginScannedWarning.value = false;
  if (previewPdfBlobUrl.value) {
    URL.revokeObjectURL(previewPdfBlobUrl.value);
    previewPdfBlobUrl.value = null;
  }
  activeTab.value = 'origin';
}

function handleSaveProfile() {
  if (currentProfile.value.fields.length === 0 && !currentProfile.value.destinationTemplateBase64) {
    showToast(t('nav.saveValidationEmpty'));
    return;
  }

  const profileName = currentProfile.value.name.trim() || 'Untitled Profile';
  currentProfile.value.name = profileName;

  // Persist to storage
  saveProfile(currentProfile.value);

  // Clear all studio fields back to 100% empty
  clearStudioToEmpty();

  // Show success toast
  showToast(t('nav.savedAndClearedToast', { name: profileName }));
}

function exportCurrentProfile() {
  exportProfileAsDocMapper(currentProfile.value);
}

function onEditProfileFromHub(profile: MappingProfile) {
  currentProfile.value = JSON.parse(JSON.stringify(profile));
  editingProfileId.value = profile.id;
  if (profile.fields.length > 0) {
    selectedFieldId.value = profile.fields[0].id;
  } else {
    selectedFieldId.value = null;
  }
  samplePdfDoc.value = null;
  samplePdfBytes.value = null;
  sampleFileName.value = '';
  if (previewPdfBlobUrl.value) {
    URL.revokeObjectURL(previewPdfBlobUrl.value);
    previewPdfBlobUrl.value = null;
  }
  activeTab.value = 'origin';
  showToast(t('nav.editingToast', { name: profile.name }));
}

const computedLiveFileNamePreview = computed(() => {
  const sampleValues: Record<string, string> = {};
  for (const f of currentProfile.value.fields) {
    sampleValues[f.name] = f.sampleExtractedValue || '185462';
    sampleValues[f.id] = f.sampleExtractedValue || '185462';
  }
  return formatOutputFileName({
    pattern: currentProfile.value.outputFileNamePattern,
    originalFileName: sampleFileName.value || 'Document.pdf',
    extractedData: sampleValues,
    docIndex: 0,
    totalDocs: 1,
  });
});

function insertNamingToken(token: string) {
  const cur = currentProfile.value.outputFileNamePattern || '';
  if (!cur.trim()) {
    currentProfile.value.outputFileNamePattern = token;
  } else {
    currentProfile.value.outputFileNamePattern = `${cur}_${token}`;
  }
}

// Generate Sample Output Preview
async function generateSamplePreview() {
  if (!currentProfile.value.destinationTemplateBase64) {
    alert(t('preview.needTemplateAlert'));
    return;
  }

  try {
    isGeneratingPreview.value = true;
    const sampleValues: Record<string, string> = {};
    for (const f of currentProfile.value.fields) {
      sampleValues[f.name] = f.sampleExtractedValue || 'SAMPLE-VAL';
      sampleValues[f.id] = f.sampleExtractedValue || 'SAMPLE-VAL';
    }

    const stampedPdfBytes = await stampDestinationPdf({
      templatePdfBytes: currentProfile.value.destinationTemplateBase64,
      mappings: currentProfile.value.destinationMappings,
      fields: currentProfile.value.fields,
      extractedValues: sampleValues,
    });

    const blob = new Blob([stampedPdfBytes as any], { type: 'application/pdf' });
    if (previewPdfBlobUrl.value) {
      URL.revokeObjectURL(previewPdfBlobUrl.value);
    }
    previewPdfBlobUrl.value = URL.createObjectURL(blob);
    activeTab.value = 'preview';
  } catch (err: any) {
    alert(`Failed to generate destination preview: ${err?.message || err}`);
  } finally {
    isGeneratingPreview.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Top Bar: Title, Profile Selector, Actions -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('nav.studioTitle') }}</h1>
          
          <!-- Editable Profile Name Badge -->
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 shadow-sm">
            <Tag class="w-3.5 h-3.5 text-brand-purple flex-shrink-0" />
            <span class="text-xs text-gray-500 font-medium">Profile:</span>
            <input
              v-model="currentProfile.name"
              class="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-purple rounded px-1.5 py-0.5 min-w-[130px]"
              placeholder="Profile Name"
            />
          </div>

          <span
            v-if="editingProfileId"
            class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          >
            Editing Profile
          </span>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ t('nav.studioSubtitle') }}
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <button
          @click="showProfileHub = true"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all shadow-sm"
        >
          <FolderOpen class="w-4 h-4 text-brand-purple" />
          <span>{{ t('nav.profiles') }}</span>
        </button>

        <button
          @click="clearStudioToEmpty"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all shadow-sm"
          title="Clear all fields back to 100% empty"
        >
          <RotateCcw class="w-4 h-4 text-gray-500" />
          <span>{{ t('nav.clear') }}</span>
        </button>

        <button
          @click="exportCurrentProfile"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all shadow-sm"
          title="Download .dmap portable profile"
        >
          <Download class="w-4 h-4 text-brand-green" />
          <span>{{ t('nav.exportDmap') }}</span>
        </button>

        <button
          @click="handleSaveProfile"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-semibold shadow-md transition-all"
        >
          <Save class="w-4 h-4" />
          <span>{{ t('nav.save') }}</span>
        </button>
      </div>
    </div>

    <!-- Toast Notification -->
    <div
      v-if="toastMessage"
      class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
    >
      <CheckCircle class="w-4 h-4" />
      <span>{{ toastMessage }}</span>
    </div>

    <!-- Workflow Steps Navigation -->
    <div class="flex border-b border-gray-200 dark:border-gray-800">
      <button
        @click="activeTab = 'origin'"
        class="flex items-center gap-2 py-3 px-6 border-b-2 font-semibold text-sm transition-all"
        :class="activeTab === 'origin' ? 'border-brand-purple text-brand-purple dark:text-purple-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        <FileText class="w-4 h-4" />
        <span>{{ t('nav.tabOrigin') }}</span>
      </button>

      <button
        @click="activeTab = 'destination'"
        class="flex items-center gap-2 py-3 px-6 border-b-2 font-semibold text-sm transition-all"
        :class="activeTab === 'destination' ? 'border-brand-purple text-brand-purple dark:text-purple-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        <FileCheck class="w-4 h-4" />
        <span>{{ t('nav.tabDestination') }}</span>
      </button>

      <button
        @click="generateSamplePreview"
        class="flex items-center gap-2 py-3 px-6 border-b-2 font-semibold text-sm transition-all"
        :class="activeTab === 'preview' ? 'border-brand-purple text-brand-purple dark:text-purple-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        <Eye class="w-4 h-4" />
        <span>{{ t('nav.tabPreview') }}</span>
      </button>
    </div>

    <!-- TAB 1: Origin Document Mapping -->
    <div v-if="activeTab === 'origin'" class="space-y-4">
      <!-- Scanned PDF Warning Alert -->
      <div
        v-if="isOriginScannedWarning"
        class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-3"
      >
        <AlertCircle class="w-5 h-5 flex-shrink-0 text-amber-500" />
        <span>
          <strong>{{ t('origin.scannedNoticeTitle') }}</strong> {{ t('origin.scannedNoticeDesc') }}
        </span>
      </div>

      <!-- Canvas & Drawer Split View -->
      <div class="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0">
        <!-- Interactive PDF Canvas or Upload placeholder -->
        <div class="flex-1 min-w-0 w-full overflow-hidden flex flex-col">
          <!-- Upload placeholder when no sample PDF is loaded -->
          <div
            v-if="!samplePdfDoc"
            class="w-full h-full min-h-[520px] p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 bg-gray-50/50 dark:bg-gray-900/50"
          >
            <div class="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-brand-purple">
              <Upload class="w-10 h-10 animate-bounce" />
            </div>
            <h3 class="font-bold text-gray-900 dark:text-white text-base">
              {{ t('origin.emptyTitle') }}
            </h3>
            <p class="text-xs text-gray-500 max-w-md">
              {{ t('origin.emptyDesc') }}
            </p>
            <label class="cursor-pointer px-5 py-2.5 bg-brand-purple text-white text-sm font-semibold rounded-xl shadow-md hover:bg-brand-purple/90 transition-all flex items-center gap-2">
              <Upload class="w-4 h-4" />
              <span>{{ t('origin.uploadSample') }}</span>
              <input type="file" accept="application/pdf,.pdf" class="hidden" @change="handleOriginUpload" />
            </label>
          </div>

          <!-- When sample PDF is loaded -->
          <template v-else>
            <!-- Top info banner -->
            <div class="w-full flex items-center justify-between mb-2 px-2 text-xs text-gray-500">
              <span class="font-medium">{{ t('origin.sampleLabel', { name: sampleFileName }) }}</span>
              <label class="cursor-pointer text-brand-purple hover:underline flex items-center gap-1 font-semibold">
                <Upload class="w-3.5 h-3.5" />
                <span>{{ t('origin.changeSample') }}</span>
                <input type="file" accept="application/pdf,.pdf" class="hidden" @change="handleOriginUpload" />
              </label>
            </div>

            <InteractivePdfCanvas
              :pdfDocument="samplePdfDoc"
              :fields="currentProfile.fields"
              :selectedFieldId="selectedFieldId"
              :activeDrawingType="activeDrawingType"
              :activeColor="activeField?.color || '#6366f1'"
              @boxDrawn="onBoxDrawn"
              @selectField="selectedFieldId = $event"
              @updateBox="onUpdateBox"
              @deleteBox="onDeleteBox"
            />
          </template>
        </div>

        <!-- Sidebar Drawer (Always Visible & Pinned Width) -->
        <FieldListDrawer
          class="flex-shrink-0 w-full lg:w-96"
          :fields="currentProfile.fields"
          :selectedFieldId="selectedFieldId"
          :activeDrawingType="activeDrawingType"
          :isAiGenerating="isAiGenerating"
          :aiError="aiError"
          @selectField="selectedFieldId = $event"
          @addField="onAddField"
          @removeField="onRemoveField"
          @updateField="onUpdateField"
          @setDrawingMode="setDrawingMode"
          @generateRuleWithAi="onGenerateRuleWithAi"
        />
      </div>
    </div>

    <!-- TAB 2: Destination Placement -->
    <div v-else-if="activeTab === 'destination'" class="w-full min-w-0">
      <DestinationPlacementCanvas
        :fields="currentProfile.fields"
        :destinationMappings="currentProfile.destinationMappings"
        :templatePdfBytes="currentProfile.destinationTemplateBase64 || null"
        :templateFileName="currentProfile.destinationTemplateName || 'Standard_Template.pdf'"
        @uploadTemplate="onUploadTemplate"
        @addMapping="onAddDestinationMapping"
        @updateMapping="onUpdateDestinationMapping"
        @removeMapping="onRemoveDestinationMapping"
      />
    </div>

    <!-- TAB 3: Output Preview Test & File Naming -->
    <div v-else-if="activeTab === 'preview'" class="space-y-6">
      <!-- Output File Naming Configuration Card -->
      <div class="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-xl bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-purple-300">
              <FileSignature class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-sm text-gray-900 dark:text-white">{{ t('preview.namingTitle') }}</h3>
              <p class="text-xs text-gray-500">{{ t('preview.namingDesc') }}</p>
            </div>
          </div>

          <!-- Live Filename Preview Pill -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-mono text-brand-purple dark:text-purple-300 shadow-inner">
            <span class="text-gray-400 font-sans text-[11px] font-normal">{{ t('preview.namingPreview') }}</span>
            <span class="font-bold truncate max-w-xs">{{ computedLiveFileNamePreview }}</span>
          </div>
        </div>

        <!-- Pattern Input & Quick Tokens -->
        <div class="space-y-2">
          <div class="relative">
            <input
              v-model="currentProfile.outputFileNamePattern"
              type="text"
              :placeholder="t('preview.namingPlaceholder')"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>

          <!-- Quick-Insert Token Chips -->
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <span class="text-xs text-gray-400 font-medium mr-1">{{ t('preview.insertToken') }}</span>
            
            <!-- Standard Tokens -->
            <button
              type="button"
              @click="insertNamingToken('{originalName}')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-purple-100 dark:bg-gray-800 dark:hover:bg-purple-950/60 text-gray-700 dark:text-gray-300 hover:text-brand-purple border border-gray-200 dark:border-gray-700 transition-colors"
              :title="t('preview.tokenOriginalName')"
            >
              + {originalName}
            </button>
            <button
              type="button"
              @click="insertNamingToken('{seq:001}')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-purple-100 dark:bg-gray-800 dark:hover:bg-purple-950/60 text-gray-700 dark:text-gray-300 hover:text-brand-purple border border-gray-200 dark:border-gray-700 transition-colors"
              :title="t('preview.tokenSeq')"
            >
              + {seq:001}
            </button>
            <button
              type="button"
              @click="insertNamingToken('{index}')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-purple-100 dark:bg-gray-800 dark:hover:bg-purple-950/60 text-gray-700 dark:text-gray-300 hover:text-brand-purple border border-gray-200 dark:border-gray-700 transition-colors"
              :title="t('preview.tokenIndex')"
            >
              + {index}
            </button>
            <button
              type="button"
              @click="insertNamingToken('{date}')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-purple-100 dark:bg-gray-800 dark:hover:bg-purple-950/60 text-gray-700 dark:text-gray-300 hover:text-brand-purple border border-gray-200 dark:border-gray-700 transition-colors"
              :title="t('preview.tokenDate')"
            >
              + {date}
            </button>

            <!-- Dynamic Field Tokens from Profile -->
            <button
              v-for="f in currentProfile.fields"
              :key="f.id"
              type="button"
              @click="insertNamingToken(`{${f.name}}`)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/50 text-brand-purple dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 transition-colors flex items-center gap-1.5"
              :title="f.name"
            >
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: f.color }"></span>
              <span>+ {<!-- -->{{ f.name }}}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Preview Header & Actions -->
      <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div>
          <h3 class="font-bold text-gray-900 dark:text-white text-base">{{ t('preview.title') }}</h3>
          <p class="text-xs text-gray-500">
            {{ t('preview.desc') }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="generateSamplePreview"
            :disabled="isGeneratingPreview"
            class="px-4 py-2 rounded-xl bg-brand-purple text-white text-xs font-semibold shadow-md hover:bg-brand-purple/90 transition-all disabled:opacity-40"
          >
            {{ isGeneratingPreview ? t('preview.rendering') : t('preview.reRender') }}
          </button>

          <a
            v-if="previewPdfBlobUrl"
            :href="previewPdfBlobUrl"
            target="_blank"
            class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            <ExternalLink class="w-4 h-4" />
            <span>{{ t('preview.openInNewTab') }}</span>
          </a>
        </div>
      </div>

      <!-- PDF Preview Iframe -->
      <div v-if="previewPdfBlobUrl" class="w-full h-[700px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl bg-white">
        <iframe :key="previewPdfBlobUrl || 'preview'" :src="previewPdfBlobUrl" class="w-full h-full border-0"></iframe>
      </div>
      <div v-else class="text-center py-20 text-gray-400 text-sm">
        {{ t('preview.emptyNotice') }}
      </div>
    </div>

    <!-- Profile Management Hub Modal -->
    <ProfileManagementModal
      :show="showProfileHub"
      :activeProfileId="editingProfileId"
      @close="showProfileHub = false"
      @selectProfile="onEditProfileFromHub"
      @editProfile="onEditProfileFromHub"
      @profilesUpdated="showToast('Profiles updated.')"
    />
  </div>
</template>
