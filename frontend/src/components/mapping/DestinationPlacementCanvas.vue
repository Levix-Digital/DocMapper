<script setup lang="ts">
import { ref, shallowRef, markRaw, toRaw, computed, watch, onMounted, nextTick } from 'vue';
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Barcode,
  QrCode,
  Type,
  FileCheck
} from 'lucide-vue-next';
import type { DestinationFieldMapping, FieldDefinition, BoundingBox, RenderFormat } from '../../types/mapping';
import { loadPdf } from '../../services/pdf/spatial-extractor';

const props = defineProps<{
  fields: FieldDefinition[];
  destinationMappings: DestinationFieldMapping[];
  templatePdfBytes: ArrayBuffer | Uint8Array | string | null;
  templateFileName?: string;
}>();

const emit = defineEmits<{
  (e: 'uploadTemplate', bytes: Uint8Array, fileName: string): void;
  (e: 'addMapping', mapping: DestinationFieldMapping): void;
  (e: 'updateMapping', mapping: DestinationFieldMapping): void;
  (e: 'removeMapping', id: string): void;
}>();

const currentPage = ref(1);
const scale = ref(1.35);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);

const loadedPdfDoc = shallowRef<any | null>(null);
const selectedMappingId = ref<string | null>(null);
const activeFieldIdToPlace = ref<string | null>(null);
const defaultRenderFormat = ref<RenderFormat>('TEXT');

// Drawing state
const isDrawing = ref(false);
const drawStart = ref<{ x: number; y: number } | null>(null);
const drawCurrent = ref<{ x: number; y: number } | null>(null);

const totalPages = computed(() => {
  const raw = toRaw(loadedPdfDoc.value);
  return raw?.numPages || 1;
});

const fieldMap = computed(() => {
  const map = new Map<string, FieldDefinition>();
  for (const f of props.fields) map.set(f.id, f);
  return map;
});

const currentMappingsOnPage = computed(() => {
  return props.destinationMappings.filter(
    m => (m.targetBox.page || 1) === currentPage.value
  );
});

const selectedMapping = computed(() => {
  return props.destinationMappings.find(m => m.id === selectedMappingId.value) || null;
});

async function initTemplatePdf() {
  if (!props.templatePdfBytes) {
    loadedPdfDoc.value = null;
    return;
  }
  try {
    const loaded = await loadPdf(props.templatePdfBytes);
    loadedPdfDoc.value = markRaw(loaded);
    currentPage.value = 1;
    await nextTick();
    renderPage();
  } catch (err) {
    console.error('Failed to parse destination template PDF:', err);
  }
}

let currentRenderTask: any = null;

async function renderPage() {
  const rawDoc = toRaw(loadedPdfDoc.value);
  if (!rawDoc || !canvasRef.value) return;

  if (currentRenderTask) {
    try {
      currentRenderTask.cancel();
    } catch (_) {}
    currentRenderTask = null;
  }

  try {
    const page = await rawDoc.getPage(currentPage.value);
    const viewport = page.getViewport({ scale: scale.value });

    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = Math.floor(viewport.width);
    const h = Math.floor(viewport.height);

    canvas.width = w;
    canvas.height = h;
    canvasWidth.value = w;
    canvasHeight.value = h;

    const renderTask = page.render({
      canvasContext: ctx,
      viewport: viewport,
    });
    currentRenderTask = renderTask;
    await renderTask.promise;
    currentRenderTask = null;
  } catch (e: any) {
    if (e?.name !== 'RenderingCancelledException') {
      console.error('Error rendering template canvas page:', e);
    }
  }
}

onMounted(() => {
  if (loadedPdfDoc.value) renderPage();
});

watch(() => props.templatePdfBytes, initTemplatePdf, { immediate: true });
watch([currentPage, scale], () => nextTick(renderPage));

function prevPage() {
  if (currentPage.value > 1) currentPage.value--;
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++;
}

// File Upload Handler
async function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  emit('uploadTemplate', new Uint8Array(arrayBuffer), file.name);
}

// Mouse Handlers for SVG target box drawing
function getRelativeCoords(e: MouseEvent): { xPercent: number; yPercent: number } | null {
  if (!svgRef.value) return null;
  const rect = svgRef.value.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;

  const xPercent = Math.min(Math.max((rawX / rect.width) * 100, 0), 100);
  const yPercent = Math.min(Math.max((rawY / rect.height) * 100, 0), 100);

  return { xPercent, yPercent };
}

function onMouseDown(e: MouseEvent) {
  if (!activeFieldIdToPlace.value) return;
  const coords = getRelativeCoords(e);
  if (!coords) return;

  isDrawing.value = true;
  drawStart.value = { x: coords.xPercent, y: coords.yPercent };
  drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
}

function onMouseMove(e: MouseEvent) {
  if (!isDrawing.value || !drawStart.value) return;
  const coords = getRelativeCoords(e);
  if (coords) drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
}

function onMouseUp() {
  if (isDrawing.value && drawStart.value && drawCurrent.value && activeFieldIdToPlace.value) {
    const minX = Math.min(drawStart.value.x, drawCurrent.value.x);
    const maxX = Math.max(drawStart.value.x, drawCurrent.value.x);
    const minY = Math.min(drawStart.value.y, drawCurrent.value.y);
    const maxY = Math.max(drawStart.value.y, drawCurrent.value.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width >= 0.5 && height >= 0.5) {
      const newBox: BoundingBox = {
        x: Number(minX.toFixed(2)),
        y: Number(minY.toFixed(2)),
        width: Number(width.toFixed(2)),
        height: Number(height.toFixed(2)),
        page: currentPage.value,
      };

      const newMapping: DestinationFieldMapping = {
        id: `dest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fieldId: activeFieldIdToPlace.value,
        targetBox: newBox,
        renderFormat: defaultRenderFormat.value,
        fontSize: 11,
      };

      emit('addMapping', newMapping);
      selectedMappingId.value = newMapping.id;
      activeFieldIdToPlace.value = null; // Reset placing mode
    }
  }

  isDrawing.value = false;
  drawStart.value = null;
  drawCurrent.value = null;
}

const draftBoxStyle = computed(() => {
  if (!isDrawing.value || !drawStart.value || !drawCurrent.value) return null;
  const minX = Math.min(drawStart.value.x, drawCurrent.value.x);
  const maxX = Math.max(drawStart.value.x, drawCurrent.value.x);
  const minY = Math.min(drawStart.value.y, drawCurrent.value.y);
  const maxY = Math.max(drawStart.value.y, drawCurrent.value.y);

  const w = canvasWidth.value || 1;
  const h = canvasHeight.value || 1;

  return {
    x: (minX * w) / 100,
    y: (minY * h) / 100,
    width: ((maxX - minX) * w) / 100,
    height: ((maxY - minY) * h) / 100,
  };
});
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0">
    <!-- Main Template Canvas Area -->
    <div class="flex-1 min-w-0 w-full overflow-hidden flex flex-col bg-gray-100 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <!-- Toolbar -->
      <div class="flex items-center justify-between w-full mb-4 px-2 flex-shrink-0">
        <!-- Page Nav -->
        <div class="flex items-center gap-2">
          <button
            @click="prevPage"
            :disabled="currentPage <= 1 || !loadedPdfDoc"
            class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft class="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            @click="nextPage"
            :disabled="currentPage >= totalPages || !loadedPdfDoc"
            class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <ChevronRight class="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <!-- Template File Indicator & Upload -->
        <div class="flex items-center gap-3">
          <label class="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors">
            <Upload class="w-3.5 h-3.5 text-brand-purple" />
            <span>{{ templateFileName || 'Upload Template PDF' }}</span>
            <input type="file" accept="application/pdf,.pdf" class="hidden" @change="handleFileSelect" />
          </label>
        </div>

        <!-- Zoom Controls -->
        <div class="flex items-center gap-2">
          <button
            @click="scale = Math.max(scale - 0.25, 0.75)"
            :disabled="scale <= 0.75 || !loadedPdfDoc"
            class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <ZoomOut class="w-4 h-4" />
          </button>
          <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
            {{ Math.round(scale * 100) }}%
          </span>
          <button
            @click="scale = Math.min(scale + 0.25, 2.5)"
            :disabled="scale >= 2.5 || !loadedPdfDoc"
            class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <ZoomIn class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Canvas or Empty State -->
      <div v-if="!loadedPdfDoc" class="flex flex-col items-center justify-center p-16 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl w-full max-w-xl text-center space-y-4 my-8">
        <Upload class="w-12 h-12 text-brand-purple animate-bounce" />
        <h3 class="text-base font-bold text-gray-900 dark:text-white">Upload Destination Delivery Note Template</h3>
        <p class="text-xs text-gray-500 max-w-sm">
          Upload a PDF template (such as your standard delivery document or consignment note) to visually place fields and barcodes.
        </p>
        <label class="cursor-pointer px-4 py-2 bg-brand-purple text-white text-sm font-semibold rounded-xl shadow-md hover:bg-brand-purple/90 transition-all">
          Select PDF Template
          <input type="file" accept="application/pdf,.pdf" class="hidden" @change="handleFileSelect" />
        </label>
      </div>

      <!-- Scroll Wrapper (Safe-centered: centers when small, left-aligned at pixel 0 with horizontal scroll when zoomed) -->
      <div v-else class="w-full overflow-auto max-h-[calc(100vh-230px)] p-2">
        <div
          class="relative shadow-2xl rounded-lg overflow-hidden border border-gray-300 dark:border-gray-800 bg-white mx-auto flex-shrink-0"
          :style="{
            width: canvasWidth ? `${canvasWidth}px` : 'auto',
            height: canvasHeight ? `${canvasHeight}px` : 'auto'
          }"
          :class="activeFieldIdToPlace ? 'cursor-crosshair' : 'cursor-default'"
        >
          <canvas
            ref="canvasRef"
            class="block"
            :style="{
              width: canvasWidth ? `${canvasWidth}px` : 'auto',
              height: canvasHeight ? `${canvasHeight}px` : 'auto'
            }"
          ></canvas>

          <!-- SVG Target Overlay -->
          <svg
            ref="svgRef"
            class="absolute inset-0 pointer-events-auto"
            :style="{
              width: canvasWidth ? `${canvasWidth}px` : '100%',
              height: canvasHeight ? `${canvasHeight}px` : '100%'
            }"
            :viewBox="canvasWidth && canvasHeight ? `0 0 ${canvasWidth} ${canvasHeight}` : undefined"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
          >
            <g
              v-for="mapping in currentMappingsOnPage"
              :key="mapping.id"
              @mousedown.stop="selectedMappingId = mapping.id"
              class="cursor-pointer group"
            >
              <!-- Target Box -->
              <rect
                :x="(mapping.targetBox.x * canvasWidth) / 100"
                :y="(mapping.targetBox.y * canvasHeight) / 100"
                :width="(mapping.targetBox.width * canvasWidth) / 100"
                :height="(mapping.targetBox.height * canvasHeight) / 100"
                :fill="fieldMap.get(mapping.fieldId)?.color || '#6366f1'"
                :fill-opacity="selectedMappingId === mapping.id ? 0.35 : 0.18"
                :stroke="fieldMap.get(mapping.fieldId)?.color || '#6366f1'"
                :stroke-width="selectedMappingId === mapping.id ? 2.5 : 1.5"
              />

              <!-- Format Badge / Text -->
              <text
                :x="(mapping.targetBox.x * canvasWidth) / 100"
                :y="Math.max(((mapping.targetBox.y * canvasHeight) / 100) - 6, 14)"
                :fill="fieldMap.get(mapping.fieldId)?.color || '#6366f1'"
                font-size="11"
                font-weight="bold"
                class="font-sans select-none drop-shadow-sm"
              >
                [{{ mapping.renderFormat }}] {{ fieldMap.get(mapping.fieldId)?.name || 'Field' }}
              </text>
            </g>

            <!-- Draft Box -->
            <rect
              v-if="draftBoxStyle"
              :x="draftBoxStyle.x"
              :y="draftBoxStyle.y"
              :width="draftBoxStyle.width"
              :height="draftBoxStyle.height"
              fill="#6366f1"
              fill-opacity="0.25"
              stroke="#6366f1"
              stroke-width="2"
              stroke-dasharray="4,4"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- Right Sidebar: Placement & Property Inspector -->
    <div class="w-full lg:w-80 flex-shrink-0 space-y-4">
      <!-- Placement Selector Card -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
        <h4 class="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
          <FileCheck class="w-4 h-4 text-brand-purple" />
          <span>Place Field on Template</span>
        </h4>
        <p class="text-xs text-gray-500">
          Select an origin field and draw where it should appear on the destination template.
        </p>

        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Choose Field to Place:
          </label>
          <select
            v-model="activeFieldIdToPlace"
            class="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
          >
            <option :value="null" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">-- Select Field --</option>
            <option v-for="f in fields" :key="f.id" :value="f.id" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
              {{ f.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Default Render Format:
          </label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              @click="defaultRenderFormat = 'TEXT'"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="defaultRenderFormat === 'TEXT' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <Type class="w-4 h-4 mb-1" />
              <span>Text</span>
            </button>
            <button
              @click="defaultRenderFormat = 'CODE128'"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="defaultRenderFormat === 'CODE128' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <Barcode class="w-4 h-4 mb-1" />
              <span>Code 128</span>
            </button>
            <button
              @click="defaultRenderFormat = 'QR_CODE'"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="defaultRenderFormat === 'QR_CODE' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <QrCode class="w-4 h-4 mb-1" />
              <span>QR Code</span>
            </button>
          </div>
        </div>

        <div v-if="activeFieldIdToPlace" class="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-brand-purple dark:text-purple-300 font-semibold animate-pulse text-center">
          Click and drag on the template to draw the target box!
        </div>
      </div>

      <!-- Selected Destination Box Inspector -->
      <div v-if="selectedMapping" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="font-bold text-sm text-gray-900 dark:text-white">
            Box Properties
          </span>
          <button
            @click="$emit('removeMapping', selectedMapping.id); selectedMappingId = null;"
            class="text-red-500 hover:text-red-600 p-1"
            title="Delete this placement box"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Bound Field:
          </label>
          <div class="font-semibold text-sm text-gray-900 dark:text-white">
            {{ fieldMap.get(selectedMapping.fieldId)?.name || 'Unknown' }}
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Render Mode:
          </label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              @click="$emit('updateMapping', { ...selectedMapping, renderFormat: 'TEXT' })"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="selectedMapping.renderFormat === 'TEXT' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <Type class="w-4 h-4 mb-1" />
              <span>Text</span>
            </button>
            <button
              @click="$emit('updateMapping', { ...selectedMapping, renderFormat: 'CODE128' })"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="selectedMapping.renderFormat === 'CODE128' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <Barcode class="w-4 h-4 mb-1" />
              <span>Code 128</span>
            </button>
            <button
              @click="$emit('updateMapping', { ...selectedMapping, renderFormat: 'QR_CODE' })"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="selectedMapping.renderFormat === 'QR_CODE' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <QrCode class="w-4 h-4 mb-1" />
              <span>QR Code</span>
            </button>
          </div>
        </div>

        <div v-if="selectedMapping.renderFormat === 'TEXT'">
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Font Size (pt, auto-scaled if larger):
          </label>
          <input
            type="number"
            min="7"
            max="18"
            :value="selectedMapping.fontSize || 11"
            @input="$emit('updateMapping', { ...selectedMapping, fontSize: Number(($event.target as HTMLInputElement).value) })"
            class="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        <div class="text-[11px] text-gray-400 font-mono">
          Coords: ({{ selectedMapping.targetBox.x }}%, {{ selectedMapping.targetBox.y }}%) • {{ selectedMapping.targetBox.width }}% × {{ selectedMapping.targetBox.height }}%
        </div>
      </div>
    </div>
  </div>
</template>
