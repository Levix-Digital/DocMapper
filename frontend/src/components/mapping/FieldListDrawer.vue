<script setup lang="ts">
import { ref } from 'vue';
import {
  Plus,
  Trash2,
  Sparkles,
  Key,
  CheckCircle2,
  Crosshair,
  Layers,
  ExternalLink
} from 'lucide-vue-next';
import type { FieldDefinition, FieldDataType } from '../../types/mapping';
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  AVAILABLE_GEMINI_MODELS
} from '../../services/llm/gemini-service';

const props = defineProps<{
  fields: FieldDefinition[];
  selectedFieldId: string | null;
  activeDrawingType: 'value' | 'label' | 'none';
  isAiGenerating?: boolean;
  aiError?: string | null;
}>();

const emit = defineEmits<{
  (e: 'selectField', id: string): void;
  (e: 'addField', field: FieldDefinition): void;
  (e: 'removeField', id: string): void;
  (e: 'updateField', field: FieldDefinition): void;
  (e: 'setDrawingMode', fieldId: string, type: 'value' | 'label'): void;
  (e: 'generateRuleWithAi', fieldId: string): void;
}>();

// Palette for new fields
const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#f97316', // Orange
];

// Add Field Modal State
const showAddModal = ref(false);
const newFieldName = ref('');
const newFieldDataType = ref<FieldDataType>('alphanumeric');

// API Key Modal State
const showKeyModal = ref(false);
const apiKeyInput = ref(getStoredApiKey());
const selectedModel = ref(getStoredModel());
const hasStoredKey = ref(!!getStoredApiKey());
function openAddModal() {
  newFieldName.value = '';
  newFieldDataType.value = 'alphanumeric';
  showAddModal.value = true;
}

function confirmAddField() {
  if (!newFieldName.value.trim()) return;

  const color = COLOR_PALETTE[props.fields.length % COLOR_PALETTE.length];
  const newField: FieldDefinition = {
    id: `field-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: newFieldName.value.trim(),
    color,
    valueBox: undefined,
    validationPattern: '',
    dataType: newFieldDataType.value,
    isRequired: true,
  };

  emit('addField', newField);
  emit('selectField', newField.id);
  emit('setDrawingMode', newField.id, 'value');
  showAddModal.value = false;
}

function toggleRequired(field: FieldDefinition) {
  emit('updateField', {
    ...field,
    isRequired: !field.isRequired,
  });
}

function updateFieldPattern(field: FieldDefinition, pattern: string) {
  emit('updateField', {
    ...field,
    validationPattern: pattern.trim(),
  });
}

function openApiKeyModal() {
  apiKeyInput.value = getStoredApiKey();
  selectedModel.value = getStoredModel();
  showKeyModal.value = true;
}

function saveApiKey() {
  setStoredApiKey(apiKeyInput.value);
  setStoredModel(selectedModel.value);
  hasStoredKey.value = !!getStoredApiKey();
  showKeyModal.value = false;
}

function handleAiButtonClick(field: FieldDefinition) {
  if (!getStoredApiKey()) {
    openApiKeyModal();
    return;
  }
  if (!field.sampleExtractedValue) {
    return;
  }
  emit('generateRuleWithAi', field.id);
}


</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 w-full sm:w-96 p-4 overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <Layers class="w-5 h-5 text-brand-purple" />
        <h2 class="font-bold text-gray-900 dark:text-white">Field Rules & Mappings</h2>
      </div>
      <button
        @click="openApiKeyModal"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
        :class="[
          hasStoredKey
            ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
            : 'border-purple-200 dark:border-purple-700 text-brand-purple dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40'
        ]"
        :title="hasStoredKey ? 'Chave Gemini configurada' : 'Configurar Google Gemini API Key'"
      >
        <Key class="w-3.5 h-3.5" />
        <span>{{ hasStoredKey ? 'Gemini OK' : 'Chave IA' }}</span>
      </button>
    </div>

    <!-- Actions -->
    <div class="my-4">
      <button
        @click="openAddModal"
        class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-medium shadow-md transition-all text-sm"
      >
        <Plus class="w-4 h-4" />
        <span>Add Field Mapping</span>
      </button>
    </div>

    <!-- Field List -->
    <div class="space-y-3 flex-grow">
      <div v-if="fields.length === 0" class="text-center py-12 text-gray-400 text-sm">
        No fields defined yet.<br />Click "+ Add Field Mapping" to start.
      </div>

      <div
        v-for="field in fields"
        :key="field.id"
        @click="$emit('selectField', field.id)"
        class="rounded-xl border transition-all p-3.5 cursor-pointer relative"
        :class="[
          selectedFieldId === field.id
            ? 'border-brand-purple shadow-sm bg-purple-50/50 dark:bg-purple-950/20'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
        ]"
      >
        <!-- Field Header -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span
              class="w-3.5 h-3.5 rounded-full flex-shrink-0"
              :style="{ backgroundColor: field.color }"
            ></span>
            <span class="font-semibold text-gray-900 dark:text-white text-sm">
              {{ field.name }}
            </span>
          </div>

          <button
            @click.stop="$emit('removeField', field.id)"
            class="text-gray-400 hover:text-red-500 p-1 transition-colors"
            title="Delete field"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>

        <!-- Drawing Targets (Value Box & Label Box) -->
        <div class="grid grid-cols-2 gap-2 my-2 text-xs">
          <!-- Value Box Button -->
          <button
            @click.stop="$emit('setDrawingMode', field.id, 'value')"
            class="flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all font-medium"
            :class="[
              activeDrawingType === 'value' && selectedFieldId === field.id
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            ]"
            title="Draw or reposition Value bounding box"
          >
            <span class="flex items-center gap-1">
              <Crosshair class="w-3.5 h-3.5" />
              <span>Value Box</span>
            </span>
            <span class="text-[10px] opacity-75">
              {{ field.valueBox ? `p.${field.valueBox.page}` : 'None' }}
            </span>
          </button>

          <!-- Label Box Button -->
          <button
            @click.stop="$emit('setDrawingMode', field.id, 'label')"
            class="flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all font-medium"
            :class="[
              activeDrawingType === 'label' && selectedFieldId === field.id
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            ]"
            title="Draw optional anchor label box"
          >
            <span class="flex items-center gap-1">
              <Crosshair class="w-3.5 h-3.5" />
              <span>Label Box</span>
            </span>
            <span class="text-[10px] opacity-75">
              {{ field.labelBox ? `p.${field.labelBox.page}` : 'None' }}
            </span>
          </button>
        </div>

        <!-- Detected Text Preview -->
        <div class="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2.5 my-2 text-xs border border-gray-100 dark:border-gray-800">
          <div class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">
            Texto Detectado (Preview):
          </div>
          <div class="font-mono text-gray-900 dark:text-white break-all text-xs font-medium">
            <span v-if="field.valueBox && field.sampleExtractedValue">
              "{{ field.sampleExtractedValue }}"
            </span>
            <span v-else class="text-gray-400 dark:text-gray-500 italic text-[11px] font-normal">
              (Desenhe a Value Box no PDF para detectar)
            </span>
          </div>
        </div>

        <!-- Extraction Status & Field Options -->
        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <!-- Status Row -->
          <div class="flex items-center justify-between text-xs">
            <span
              v-if="field.valueBox && field.sampleExtractedValue"
              class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]"
            >
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
              <span>Calibrado (LSIE)</span>
            </span>
            <span
              v-else
              class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 italic text-[11px]"
            >
              <span>Aguardando demarcação</span>
            </span>

            <!-- Required Toggle -->
            <label class="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-400 text-xs select-none" @click.stop>
              <input
                type="checkbox"
                :checked="field.isRequired"
                @change="toggleRequired(field)"
                class="rounded border-gray-300 text-brand-purple focus:ring-brand-purple w-3.5 h-3.5 cursor-pointer"
              />
              <span class="text-[11px] font-medium">Obrigatório</span>
            </label>
          </div>

          <!-- Advanced Settings (Optional / Collapsed) -->
          <details class="text-xs text-gray-500 group pt-1" @click.stop>
            <summary class="cursor-pointer hover:text-gray-800 dark:hover:text-gray-300 text-[11px] flex items-center justify-between py-1 transition-colors select-none">
              <span>Filtro Avançado (Opcional)</span>
              <span class="text-[10px] text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            
            <div class="pt-2 space-y-2 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 mt-1">
              <div>
                <label class="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">
                  Máscara Regex (opcional):
                </label>
                <input
                  :value="field.validationPattern || ''"
                  @input="updateFieldPattern(field, ($event.target as HTMLInputElement).value)"
                  type="text"
                  placeholder="ex: ^[0-9]+$ (deixe vazio para aceitar tudo)"
                  class="w-full px-2 py-1 text-xs font-mono rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                />
              </div>

              <button
                v-if="hasStoredKey && field.sampleExtractedValue"
                @click.stop="handleAiButtonClick(field)"
                :disabled="isAiGenerating"
                class="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-purple-200 dark:border-purple-800 text-[11px] font-medium text-brand-purple dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors disabled:opacity-50"
              >
                <Sparkles class="w-3 h-3" :class="{ 'animate-spin': isAiGenerating }" />
                <span>{{ isAiGenerating ? 'Sugerindo com Gemini...' : 'Sugerir Regex com IA' }}</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- Add Field Modal -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 w-full max-w-sm shadow-xl space-y-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Add New Field</h3>
        <div>
          <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Field Name
          </label>
          <input
            v-model="newFieldName"
            placeholder="e.g. Shipment Number, Carrier..."
            class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
            @keyup.enter="confirmAddField"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Data Type
          </label>
          <select
            v-model="newFieldDataType"
            class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
          >
            <option value="alphanumeric" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Alphanumeric (Letters & Numbers)</option>
            <option value="text" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">General Text</option>
            <option value="date" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Date</option>
            <option value="number" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Number</option>
            <option value="multiline" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Multiline</option>
          </select>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            @click="showAddModal = false"
            class="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="confirmAddField"
            :disabled="!newFieldName.trim()"
            class="px-4 py-1.5 rounded-lg text-sm bg-brand-purple text-white hover:bg-brand-purple/90 font-medium disabled:opacity-40"
          >
            Add Field
          </button>
        </div>
      </div>
    </div>

    <!-- Gemini API Key Modal -->
    <div
      v-if="showKeyModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 w-full max-w-md shadow-xl space-y-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Key class="w-5 h-5 text-brand-purple" />
          <span>Configurar Google Gemini API</span>
        </h3>

        <div class="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200 space-y-1.5">
          <p class="font-semibold text-brand-purple dark:text-purple-300">Como obter sua chave gratuita:</p>
          <p class="text-[11px] text-gray-600 dark:text-gray-400">
            A IA é utilizada apenas no mapeamento inicial para deduzir expressões regulares (Regex) a partir de um valor de exemplo. Todo o processamento dos lotes de documentos ocorre 100% offline no seu navegador.
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-brand-purple dark:text-purple-300 font-semibold hover:underline pt-1 text-xs"
          >
            <span>Obter chave gratuita no Google AI Studio</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>

        <!-- Model Selector & Observability -->
        <div class="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-2.5">
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Modelo Gemini:
            </label>
            <select
              v-model="selectedModel"
              class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-purple"
            >
              <option
                v-for="m in AVAILABLE_GEMINI_MODELS"
                :key="m.id"
                :value="m.id"
                class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                {{ m.name }} — {{ m.tag }}
              </option>
            </select>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {{ AVAILABLE_GEMINI_MODELS.find(m => m.id === selectedModel)?.description || 'Modelo otimizado para extração e inferência rápida.' }}
            </p>
          </div>

          <div class="pt-1.5 border-t border-gray-200 dark:border-gray-700/80 flex items-center justify-between text-[11px]">
            <span class="text-gray-600 dark:text-gray-400">Observabilidade & Métricas:</span>
            <a
              href="https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/metrics"
              target="_blank"
              rel="noopener noreferrer"
              class="text-brand-purple dark:text-purple-300 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              <span>Ver Métricas no GCP</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Chave da API (API Key):
          </label>
          <input
            v-model="apiKeyInput"
            type="password"
            placeholder="AIzaSy..."
            class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-purple"
            @keyup.enter="saveApiKey"
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            @click="showKeyModal = false"
            class="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="saveApiKey"
            class="px-4 py-1.5 rounded-lg text-sm bg-brand-purple text-white hover:bg-brand-purple/90 font-medium"
          >
            Salvar Chave
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
