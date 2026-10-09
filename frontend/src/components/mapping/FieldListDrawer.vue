<script setup lang="ts">
import { ref } from 'vue';
import {
  Plus,
  Trash2,
  Sparkles,
  Key,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Check,
  X,
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
  AVAILABLE_GEMINI_MODELS,
  testRegexPattern,
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

// Manual Edit Rule State
const editingFieldId = ref<string | null>(null);
const editPattern = ref('');
const editDataType = ref<FieldDataType>('text');

// Manual Edit Sample Value State
const editingSampleFieldId = ref<string | null>(null);
const editSampleValue = ref('');

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
    valueBox: { x: 20, y: 20, width: 25, height: 4, page: 1 },
    validationPattern: '.+',
    dataType: newFieldDataType.value,
    isRequired: true,
  };

  emit('addField', newField);
  emit('selectField', newField.id);
  showAddModal.value = false;
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

function startEditingSample(field: FieldDefinition) {
  editingSampleFieldId.value = field.id;
  editSampleValue.value = field.sampleExtractedValue || '';
}

function saveEditingSample(field: FieldDefinition) {
  const updated: FieldDefinition = {
    ...field,
    sampleExtractedValue: editSampleValue.value.trim() || undefined,
  };
  emit('updateField', updated);
  editingSampleFieldId.value = null;
}

function cancelEditingSample() {
  editingSampleFieldId.value = null;
}

function handleAiButtonClick(field: FieldDefinition) {
  // If user typed in the sample input and clicked AI without hitting Enter/Save, commit it first
  if (editingSampleFieldId.value === field.id && editSampleValue.value.trim()) {
    field.sampleExtractedValue = editSampleValue.value.trim();
    saveEditingSample(field);
  }
  if (!getStoredApiKey()) {
    openApiKeyModal();
    return;
  }
  if (!field.sampleExtractedValue) {
    startEditingSample(field);
    return;
  }
  emit('generateRuleWithAi', field.id);
}

function startEditingRule(field: FieldDefinition) {
  editingFieldId.value = field.id;
  editPattern.value = field.validationPattern;
  editDataType.value = field.dataType;
}

function saveEditingRule(field: FieldDefinition) {
  const updated: FieldDefinition = {
    ...field,
    validationPattern: editPattern.value.trim() || '.+',
    dataType: editDataType.value,
  };
  emit('updateField', updated);
  editingFieldId.value = null;
}

function cancelEditingRule() {
  editingFieldId.value = null;
}

function checkPatternMatch(field: FieldDefinition) {
  if (!field.sampleExtractedValue) return null;
  return testRegexPattern(field.validationPattern, field.sampleExtractedValue);
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
              p.{{ field.valueBox?.page || 1 }}
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

        <!-- Extracted Sample Value Preview & Inline Editor -->
        <div class="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2.5 my-2 text-xs border border-gray-100 dark:border-gray-800">
          <div class="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
            <span>Sample Value (Exemplo):</span>
            <button
              v-if="editingSampleFieldId !== field.id"
              @click.stop="startEditingSample(field)"
              class="text-brand-purple hover:underline text-[11px] flex items-center gap-0.5 font-normal capitalize"
              title="Digitar ou editar valor de exemplo manualmente"
            >
              <Edit2 class="w-2.5 h-2.5" />
              <span>{{ field.sampleExtractedValue ? 'editar' : '+ digitar' }}</span>
            </button>
          </div>

          <!-- Normal Display of Sample Value -->
          <div v-if="editingSampleFieldId !== field.id" class="font-mono text-gray-800 dark:text-gray-200 break-all text-xs">
            <span v-if="field.sampleExtractedValue" class="text-gray-900 dark:text-white font-medium">
              "{{ field.sampleExtractedValue }}"
            </span>
            <span v-else class="text-gray-400 dark:text-gray-500 italic text-[11px]">
              (Desenhe a caixa no PDF ou clique em "+ digitar")
            </span>
          </div>

          <!-- Inline Edit of Sample Value -->
          <div v-else class="space-y-1.5 pt-0.5">
            <input
              v-model="editSampleValue"
              type="text"
              placeholder="ex: 015-TSO-1234, 123456, 12/05/2024..."
              class="w-full px-2 py-1 text-xs font-mono rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-purple"
              @keyup.enter="saveEditingSample(field)"
              @click.stop
              autofocus
            />
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-gray-400">Pressione Enter para salvar</span>
              <div class="flex items-center gap-1.5">
                <button
                  @click.stop="cancelEditingSample"
                  class="px-2 py-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  @click.stop="saveEditingSample(field)"
                  class="px-2.5 py-0.5 bg-brand-purple text-white rounded font-medium hover:bg-brand-purple/90"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pattern Rule & AI Generator -->
        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <!-- Normal View -->
          <div v-if="editingFieldId !== field.id" class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5 font-mono text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[170px]" :title="field.validationPattern">
                Rule: {{ field.validationPattern }}
              </div>
              <button
                @click.stop="startEditingRule(field)"
                class="text-brand-purple hover:underline text-[11px] flex items-center gap-0.5"
              >
                <Edit2 class="w-3 h-3" /> Edit
              </button>
            </div>

            <!-- Validation Match Status -->
            <div v-if="field.sampleExtractedValue" class="flex items-center justify-between text-[11px]">
              <span
                v-if="checkPatternMatch(field)?.matches"
                class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"
              >
                <CheckCircle2 class="w-3.5 h-3.5" /> 100% Match on Sample
              </span>
              <span
                v-else
                class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold"
              >
                <AlertTriangle class="w-3.5 h-3.5" /> Pattern Mismatch
              </span>
            </div>

            <!-- AI Rule Trigger -->
            <div class="space-y-1 pt-0.5">
              <button
                @click.stop="handleAiButtonClick(field)"
                :disabled="isAiGenerating"
                class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                :class="[
                  !hasStoredKey
                    ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100/70'
                    : !field.sampleExtractedValue
                      ? 'border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 text-brand-purple dark:text-purple-300 hover:bg-purple-100/60'
                      : 'border-purple-300 dark:border-purple-700 bg-brand-purple hover:bg-brand-purple/90 text-white shadow-purple-500/20'
                ]"
              >
                <Sparkles class="w-3.5 h-3.5" :class="{ 'animate-spin': isAiGenerating }" />
                <span v-if="isAiGenerating">Gerando regra com Gemini...</span>
                <span v-else-if="!hasStoredKey">Configurar Chave do Gemini (🔑)</span>
                <span v-else-if="!field.sampleExtractedValue">Definir Exemplo p/ Ativar Gemini</span>
                <span v-else>Gerar Regra com IA (Gemini)</span>
              </button>

              <p
                v-if="!field.sampleExtractedValue && hasStoredKey"
                class="text-[10px] text-gray-500 dark:text-gray-400 text-center"
              >
                Desenhe a caixa no PDF ou clique em "+ digitar" acima
              </p>

              <!-- AI Error Message Display -->
              <div
                v-if="aiError && selectedFieldId === field.id"
                class="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-[11px] space-y-1"
              >
                <div class="font-semibold flex items-center gap-1">
                  <AlertTriangle class="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span>Erro do Gemini:</span>
                </div>
                <div class="font-mono text-[10px] break-words">
                  {{ aiError }}
                </div>
              </div>
            </div>
          </div>

          <!-- Inline Edit View -->
          <div v-else class="space-y-2 bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
            <div>
              <label class="block text-[10px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Regex Validation Pattern:
              </label>
              <input
                v-model="editPattern"
                type="text"
                class="w-full px-2 py-1 text-xs font-mono rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Data Type:
              </label>
              <select
                v-model="editDataType"
                class="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                <option value="text">Text (General)</option>
                <option value="alphanumeric">Alphanumeric (Letters & Digits)</option>
                <option value="number">Number (Numeric)</option>
                <option value="date">Date</option>
                <option value="multiline">Multiline</option>
              </select>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                @click.stop="cancelEditingRule"
                class="p-1 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                title="Cancel"
              >
                <X class="w-4 h-4" />
              </button>
              <button
                @click.stop="saveEditingRule(field)"
                class="p-1 rounded bg-brand-purple text-white hover:bg-brand-purple/90"
                title="Save Pattern"
              >
                <Check class="w-4 h-4" />
              </button>
            </div>
          </div>
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
            class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
            @keyup.enter="confirmAddField"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Data Type
          </label>
          <select
            v-model="newFieldDataType"
            class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
          >
            <option value="alphanumeric">Alphanumeric (Letters & Numbers)</option>
            <option value="text">General Text</option>
            <option value="date">Date</option>
            <option value="number">Number</option>
            <option value="multiline">Multiline</option>
          </select>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            @click="showAddModal = false"
            class="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
              class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-purple"
            >
              <option
                v-for="m in AVAILABLE_GEMINI_MODELS"
                :key="m.id"
                :value="m.id"
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
            class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-purple"
            @keyup.enter="saveApiKey"
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            @click="showKeyModal = false"
            class="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
