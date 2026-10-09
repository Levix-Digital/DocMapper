<script setup lang="ts">
import { ref, shallowRef, markRaw, toRaw, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
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
import type {
  DestinationFieldMapping,
  FieldDefinition,
  BoundingBox,
  RenderFormat,
  HorizontalAlignment,
  VerticalAlignment
} from '../../types/mapping';
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
const placementMode = ref<'field' | 'custom'>('field');
const activeFieldIdToPlace = ref<string | null>(null);
const customTextToPlace = ref<string>('Custom Text');
const defaultRenderFormat = ref<RenderFormat>('TEXT');

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

interface ActiveTransform {
  mappingId: string;
  mode: 'move' | 'resize';
  handle?: ResizeHandle;
  initialBox: BoundingBox;
  currentBox: BoundingBox;
  startPercent: { x: number; y: number };
}

// Local interactive transform state (silky smooth 60 FPS without storage freeze)
const activeTransform = ref<ActiveTransform | null>(null);

// Drawing state for new placement
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

const selectedMappingOnCurrentPage = computed(() => {
  if (!selectedMapping.value) return null;
  const p = selectedMapping.value.targetBox.page || 1;
  return p === currentPage.value ? selectedMapping.value : null;
});

const selectedRenderBox = computed<BoundingBox>(() => {
  if (!selectedMapping.value) {
    return { x: 0, y: 0, width: 0, height: 0, page: 1 };
  }
  if (
    activeTransform.value &&
    activeTransform.value.mappingId === selectedMapping.value.id
  ) {
    return activeTransform.value.currentBox;
  }
  return selectedMapping.value.targetBox;
});

function getMappingColor(mapping: DestinationFieldMapping): string {
  if (mapping.sourceType === 'custom') {
    return '#8b5cf6'; // Violet / Purple for custom/static text
  }
  return fieldMap.value.get(mapping.fieldId || '')?.color || '#6366f1';
}

const selectedFieldColor = computed(() => {
  if (!selectedMapping.value) return '#6366f1';
  return getMappingColor(selectedMapping.value);
});

function getMappingDisplayText(mapping: DestinationFieldMapping): string {
  if (mapping.sourceType === 'custom') {
    return mapping.customText || 'Custom Text';
  }
  const fieldName = fieldMap.value.get(mapping.fieldId || '')?.name || 'Field';
  const prefix = mapping.prefix || '';
  const suffix = mapping.suffix || '';
  return `${prefix}${fieldName}${suffix}`;
}

function getTextAnchor(hAlign?: HorizontalAlignment): 'start' | 'middle' | 'end' {
  if (hAlign === 'center') return 'middle';
  if (hAlign === 'right') return 'end';
  return 'start';
}

function getTextAnchorX(box: BoundingBox, hAlign?: HorizontalAlignment): number {
  const w = canvasWidth.value || 1;
  const left = (box.x * w) / 100;
  const width = (box.width * w) / 100;
  if (hAlign === 'center') return left + width / 2;
  if (hAlign === 'right') return left + width - 6;
  return left + 6;
}

function getTextAnchorY(box: BoundingBox, vAlign?: VerticalAlignment): number {
  const h = canvasHeight.value || 1;
  const top = (box.y * h) / 100;
  const height = (box.height * h) / 100;
  if (vAlign === 'top') return top + 14;
  if (vAlign === 'bottom') return top + height - 6;
  return top + height / 2 + 4; // middle
}

const isReadyToDraw = computed(() => {
  if (placementMode.value === 'custom') {
    return !!customTextToPlace.value.trim();
  }
  return !!activeFieldIdToPlace.value;
});

function getBoxToRender(mapping: DestinationFieldMapping): BoundingBox {
  if (
    activeTransform.value &&
    activeTransform.value.mappingId === mapping.id
  ) {
    return activeTransform.value.currentBox;
  }
  return mapping.targetBox;
}

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

// Convert client mouse coords to 0..100% relative coordinates
function getRelativeCoords(e: MouseEvent): { xPercent: number; yPercent: number } | null {
  if (!svgRef.value) return null;
  const rect = svgRef.value.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;

  const xPercent = Math.min(Math.max((rawX / rect.width) * 100, 0), 100);
  const yPercent = Math.min(Math.max((rawY / rect.height) * 100, 0), 100);

  return { xPercent, yPercent };
}

// Canvas background mouse down (drawing new box or deselecting)
function onCanvasMouseDown(e: MouseEvent) {
  const coords = getRelativeCoords(e);
  if (!coords) return;

  if (isReadyToDraw.value) {
    isDrawing.value = true;
    drawStart.value = { x: coords.xPercent, y: coords.yPercent };
    drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
  } else {
    // Clicked empty background: deselect
    selectedMappingId.value = null;
  }
}

function onCanvasMouseMove(e: MouseEvent) {
  if (isDrawing.value && drawStart.value) {
    const coords = getRelativeCoords(e);
    if (coords) {
      drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
    }
  }
}

function onCanvasMouseUp() {
  if (isDrawing.value && drawStart.value && drawCurrent.value && isReadyToDraw.value) {
    const minX = Math.min(drawStart.value.x, drawCurrent.value.x);
    const maxX = Math.max(drawStart.value.x, drawCurrent.value.x);
    const minY = Math.min(drawStart.value.y, drawCurrent.value.y);
    const maxY = Math.max(drawStart.value.y, drawCurrent.value.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width >= 0.8 && height >= 0.5) {
      const newBox: BoundingBox = {
        x: Number(minX.toFixed(2)),
        y: Number(minY.toFixed(2)),
        width: Number(width.toFixed(2)),
        height: Number(height.toFixed(2)),
        page: currentPage.value,
      };

      const isCustom = placementMode.value === 'custom';
      const newMapping: DestinationFieldMapping = {
        id: `dest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sourceType: isCustom ? 'custom' : 'field',
        fieldId: isCustom ? null : activeFieldIdToPlace.value,
        customText: isCustom ? (customTextToPlace.value || 'Custom Text') : undefined,
        prefix: '',
        suffix: '',
        targetBox: newBox,
        renderFormat: defaultRenderFormat.value,
        fontSize: 11,
        horizontalAlign: isCustom ? 'center' : 'left',
        verticalAlign: 'middle',
      };

      emit('addMapping', newMapping);
      selectedMappingId.value = newMapping.id;
      if (!isCustom) {
        activeFieldIdToPlace.value = null;
      }
    }
  }

  isDrawing.value = false;
  drawStart.value = null;
  drawCurrent.value = null;
}

// Start moving a mapping box
function startMoveMapping(e: MouseEvent, mapping: DestinationFieldMapping) {
  e.stopPropagation();
  selectedMappingId.value = mapping.id;

  const coords = getRelativeCoords(e);
  if (!coords) return;

  const cur = { ...mapping.targetBox };
  activeTransform.value = {
    mappingId: mapping.id,
    mode: 'move',
    initialBox: { ...cur },
    currentBox: { ...cur },
    startPercent: { x: coords.xPercent, y: coords.yPercent },
  };

  window.addEventListener('mousemove', onGlobalMouseMove, { passive: false });
  window.addEventListener('mouseup', onGlobalMouseUp);
}

// Start resizing a mapping box from one of the 8 handles
function startResizeMapping(
  e: MouseEvent,
  mapping: DestinationFieldMapping,
  handle: ResizeHandle
) {
  e.stopPropagation();
  selectedMappingId.value = mapping.id;

  const coords = getRelativeCoords(e);
  if (!coords) return;

  const cur = { ...mapping.targetBox };
  activeTransform.value = {
    mappingId: mapping.id,
    mode: 'resize',
    handle,
    initialBox: { ...cur },
    currentBox: { ...cur },
    startPercent: { x: coords.xPercent, y: coords.yPercent },
  };

  window.addEventListener('mousemove', onGlobalMouseMove, { passive: false });
  window.addEventListener('mouseup', onGlobalMouseUp);
}

// Global mouse move handles both move and resize smoothly without store lag
function onGlobalMouseMove(e: MouseEvent) {
  if (!activeTransform.value) return;
  e.preventDefault();

  const coords = getRelativeCoords(e);
  if (!coords) return;

  const { mode, handle, initialBox, startPercent } = activeTransform.value;
  const deltaX = coords.xPercent - startPercent.x;
  const deltaY = coords.yPercent - startPercent.y;

  if (mode === 'move') {
    const newX = Math.min(Math.max(initialBox.x + deltaX, 0), 100 - initialBox.width);
    const newY = Math.min(Math.max(initialBox.y + deltaY, 0), 100 - initialBox.height);

    activeTransform.value.currentBox = {
      ...initialBox,
      x: Number(newX.toFixed(2)),
      y: Number(newY.toFixed(2)),
    };
  } else if (mode === 'resize' && handle) {
    let newX = initialBox.x;
    let newY = initialBox.y;
    let newW = initialBox.width;
    let newH = initialBox.height;

    // Horizontal adjustments
    if (handle.includes('w')) {
      const targetX = initialBox.x + deltaX;
      const maxX = initialBox.x + initialBox.width - 0.8;
      newX = Math.max(0, Math.min(targetX, maxX));
      newW = initialBox.x + initialBox.width - newX;
    } else if (handle.includes('e')) {
      const targetW = initialBox.width + deltaX;
      newW = Math.max(0.8, Math.min(targetW, 100 - initialBox.x));
    }

    // Vertical adjustments
    if (handle.includes('n')) {
      const targetY = initialBox.y + deltaY;
      const maxY = initialBox.y + initialBox.height - 0.5;
      newY = Math.max(0, Math.min(targetY, maxY));
      newH = initialBox.y + initialBox.height - newY;
    } else if (handle.includes('s')) {
      const targetH = initialBox.height + deltaY;
      newH = Math.max(0.5, Math.min(targetH, 100 - initialBox.y));
    }

    activeTransform.value.currentBox = {
      ...initialBox,
      x: Number(newX.toFixed(2)),
      y: Number(newY.toFixed(2)),
      width: Number(newW.toFixed(2)),
      height: Number(newH.toFixed(2)),
    };
  }
}

// Global mouse up commits the transform once to the parent store
function onGlobalMouseUp() {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);

  if (!activeTransform.value) return;

  const { mappingId, currentBox, initialBox } = activeTransform.value;
  activeTransform.value = null;

  const mapping = props.destinationMappings.find(m => m.id === mappingId);
  if (!mapping) return;

  if (
    currentBox.x !== initialBox.x ||
    currentBox.y !== initialBox.y ||
    currentBox.width !== initialBox.width ||
    currentBox.height !== initialBox.height
  ) {
    emit('updateMapping', {
      ...mapping,
      targetBox: { ...currentBox },
    });
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

function updateMappingBoxProp(prop: keyof BoundingBox, val: number) {
  if (!selectedMapping.value) return;
  const current = selectedMapping.value.targetBox;
  const updated: BoundingBox = {
    ...current,
    [prop]: Number(Math.max(val, 0).toFixed(2)),
  };
  emit('updateMapping', {
    ...selectedMapping.value,
    targetBox: updated,
  });
}

function nudgeMapping(dx: number, dy: number) {
  if (!selectedMapping.value) return;
  const current = selectedMapping.value.targetBox;
  const newX = Math.min(Math.max(current.x + dx, 0), 100 - current.width);
  const newY = Math.min(Math.max(current.y + dy, 0), 100 - current.height);
  emit('updateMapping', {
    ...selectedMapping.value,
    targetBox: {
      ...current,
      x: Number(newX.toFixed(2)),
      y: Number(newY.toFixed(2)),
    },
  });
}

function changeMappingPage(newPage: number) {
  if (!selectedMapping.value) return;
  emit('updateMapping', {
    ...selectedMapping.value,
    targetBox: {
      ...selectedMapping.value.targetBox,
      page: newPage,
    },
  });
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
          :class="isReadyToDraw ? 'cursor-crosshair' : 'cursor-default'"
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
            @mousedown="onCanvasMouseDown"
            @mousemove="onCanvasMouseMove"
            @mouseup="onCanvasMouseUp"
          >
            <!-- 1. Render all placed mapping boxes -->
            <g
              v-for="mapping in currentMappingsOnPage"
              :key="mapping.id"
              class="group cursor-grab active:cursor-grabbing"
              @mousedown="startMoveMapping($event, mapping)"
            >
              <!-- Target Box -->
              <rect
                :x="(getBoxToRender(mapping).x * canvasWidth) / 100"
                :y="(getBoxToRender(mapping).y * canvasHeight) / 100"
                :width="(getBoxToRender(mapping).width * canvasWidth) / 100"
                :height="(getBoxToRender(mapping).height * canvasHeight) / 100"
                :fill="getMappingColor(mapping)"
                :fill-opacity="selectedMappingId === mapping.id ? 0.35 : 0.18"
                :stroke="getMappingColor(mapping)"
                :stroke-width="selectedMappingId === mapping.id ? 2.5 : 1.5"
                rx="3"
                class="transition-opacity"
              />

              <!-- Top Format & Name Badge -->
              <text
                :x="(getBoxToRender(mapping).x * canvasWidth) / 100"
                :y="Math.max(((getBoxToRender(mapping).y * canvasHeight) / 100) - 6, 14)"
                :fill="getMappingColor(mapping)"
                font-size="10"
                font-weight="bold"
                class="font-sans select-none drop-shadow-sm pointer-events-none uppercase tracking-wide"
              >
                [{{ mapping.sourceType === 'custom' ? 'CUSTOM' : mapping.renderFormat }}] {{ mapping.sourceType === 'custom' ? 'Custom Text' : (fieldMap.get(mapping.fieldId || '')?.name || 'Field') }}
              </text>

              <!-- In-box Content Preview with Horizontal and Vertical Alignment -->
              <text
                v-if="mapping.renderFormat === 'TEXT'"
                :x="getTextAnchorX(getBoxToRender(mapping), mapping.horizontalAlign || 'left')"
                :y="getTextAnchorY(getBoxToRender(mapping), mapping.verticalAlign || 'middle')"
                :text-anchor="getTextAnchor(mapping.horizontalAlign || 'left')"
                :fill="getMappingColor(mapping)"
                font-size="11"
                font-weight="bold"
                class="font-sans select-none pointer-events-none drop-shadow-sm"
              >
                {{ getMappingDisplayText(mapping) }}
              </text>
            </g>

            <!-- 2. TOP-LAYER SELECTION & 8-HANDLE RESIZING OVERLAY (Always on top of all boxes) -->
            <g
              v-if="selectedMappingOnCurrentPage"
              class="pointer-events-auto"
            >
              <!-- Selection Highlight Outer Ring -->
              <rect
                :x="(selectedRenderBox.x * canvasWidth) / 100 - 1"
                :y="(selectedRenderBox.y * canvasHeight) / 100 - 1"
                :width="(selectedRenderBox.width * canvasWidth) / 100 + 2"
                :height="(selectedRenderBox.height * canvasHeight) / 100 + 2"
                fill="none"
                :stroke="selectedFieldColor"
                stroke-width="2"
                stroke-dasharray="4,3"
                rx="4"
                class="pointer-events-none"
              />

              <!-- NW Handle (Corner) -->
              <circle
                :cx="(selectedRenderBox.x * canvasWidth) / 100"
                :cy="(selectedRenderBox.y * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-nwse-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'nw')"
              />
              <circle
                :cx="(selectedRenderBox.x * canvasWidth) / 100"
                :cy="(selectedRenderBox.y * canvasHeight) / 100"
                r="6"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2.5"
                class="cursor-nwse-resize pointer-events-none drop-shadow-md"
              />

              <!-- N Handle (Top Middle) -->
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width / 2) * canvasWidth) / 100"
                :cy="(selectedRenderBox.y * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-ns-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'n')"
              />
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width / 2) * canvasWidth) / 100"
                :cy="(selectedRenderBox.y * canvasHeight) / 100"
                r="5"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2"
                class="cursor-ns-resize pointer-events-none drop-shadow-md"
              />

              <!-- NE Handle (Corner) -->
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width) * canvasWidth) / 100"
                :cy="(selectedRenderBox.y * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-nesw-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'ne')"
              />
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width) * canvasWidth) / 100"
                :cy="(selectedRenderBox.y * canvasHeight) / 100"
                r="6"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2.5"
                class="cursor-nesw-resize pointer-events-none drop-shadow-md"
              />

              <!-- E Handle (Right Middle) -->
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width) * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height / 2) * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-ew-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'e')"
              />
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width) * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height / 2) * canvasHeight) / 100"
                r="5"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2"
                class="cursor-ew-resize pointer-events-none drop-shadow-md"
              />

              <!-- SE Handle (Corner) -->
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width) * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height) * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-nwse-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'se')"
              />
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width) * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height) * canvasHeight) / 100"
                r="6"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2.5"
                class="cursor-nwse-resize pointer-events-none drop-shadow-md"
              />

              <!-- S Handle (Bottom Middle) -->
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width / 2) * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height) * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-ns-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 's')"
              />
              <circle
                :cx="((selectedRenderBox.x + selectedRenderBox.width / 2) * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height) * canvasHeight) / 100"
                r="5"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2"
                class="cursor-ns-resize pointer-events-none drop-shadow-md"
              />

              <!-- SW Handle (Corner) -->
              <circle
                :cx="(selectedRenderBox.x * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height) * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-nesw-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'sw')"
              />
              <circle
                :cx="(selectedRenderBox.x * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height) * canvasHeight) / 100"
                r="6"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2.5"
                class="cursor-nesw-resize pointer-events-none drop-shadow-md"
              />

              <!-- W Handle (Left Middle) -->
              <circle
                :cx="(selectedRenderBox.x * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height / 2) * canvasHeight) / 100"
                r="14"
                fill="transparent"
                class="cursor-ew-resize"
                @mousedown.stop="startResizeMapping($event, selectedMappingOnCurrentPage, 'w')"
              />
              <circle
                :cx="(selectedRenderBox.x * canvasWidth) / 100"
                :cy="((selectedRenderBox.y + selectedRenderBox.height / 2) * canvasHeight) / 100"
                r="5"
                fill="#ffffff"
                :stroke="selectedFieldColor"
                stroke-width="2"
                class="cursor-ew-resize pointer-events-none drop-shadow-md"
              />
            </g>

            <!-- 3. Draft Box for new placement -->
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
          <span>Place on Template</span>
        </h4>

        <!-- Mode Toggle: Mapped Origin Field vs Custom Static Text -->
        <div class="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-semibold">
          <button
            @click="placementMode = 'field'"
            class="py-1.5 px-2 rounded-lg transition-all"
            :class="placementMode === 'field' ? 'bg-white dark:bg-gray-700 text-brand-purple dark:text-purple-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'"
          >
            Campo de Origem
          </button>
          <button
            @click="placementMode = 'custom'"
            class="py-1.5 px-2 rounded-lg transition-all"
            :class="placementMode === 'custom' ? 'bg-white dark:bg-gray-700 text-brand-purple dark:text-purple-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'"
          >
            + Texto Fixo
          </button>
        </div>

        <!-- If Mapped Field -->
        <div v-if="placementMode === 'field'">
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Choose Origin Field:
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

        <!-- If Custom Text -->
        <div v-else>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Custom Text Content:
          </label>
          <input
            v-model="customTextToPlace"
            type="text"
            placeholder="e.g. APPROVED, ISSUED IN 2026..."
            class="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Render Format:
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

        <div v-if="isReadyToDraw" class="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-brand-purple dark:text-purple-300 font-semibold animate-pulse text-center">
          Click and drag on the document to draw the placement box!
        </div>
      </div>

      <!-- Selected Destination Box Inspector -->
      <div v-if="selectedMapping" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
            <Move class="w-4 h-4 text-brand-purple" />
            <span>Box Properties</span>
          </span>
          <button
            @click="$emit('removeMapping', selectedMapping.id); selectedMappingId = null;"
            class="text-red-500 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
            title="Delete this placement box"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>

        <!-- 1. Content Definition (Custom Text or Mapped Field with Prefix/Suffix) -->
        <div v-if="selectedMapping.sourceType === 'custom'" class="space-y-1.5">
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300">
            Custom Static Text:
          </label>
          <input
            type="text"
            :value="selectedMapping.customText || ''"
            @input="$emit('updateMapping', { ...selectedMapping, customText: ($event.target as HTMLInputElement).value })"
            class="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        <div v-else class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
              Bound Field:
            </label>
            <span class="text-xs font-bold text-gray-900 dark:text-white">
              {{ fieldMap.get(selectedMapping.fieldId || '')?.name || 'Unknown' }}
            </span>
          </div>

          <!-- Prefix & Suffix Customization -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
                Prefix (before):
              </label>
              <input
                type="text"
                placeholder="e.g. No: "
                :value="selectedMapping.prefix || ''"
                @input="$emit('updateMapping', { ...selectedMapping, prefix: ($event.target as HTMLInputElement).value })"
                class="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
                Suffix (after):
              </label>
              <input
                type="text"
                placeholder="e.g.  (UN)"
                :value="selectedMapping.suffix || ''"
                @input="$emit('updateMapping', { ...selectedMapping, suffix: ($event.target as HTMLInputElement).value })"
                class="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>
          </div>

          <!-- Live Combined Preview Tag -->
          <div class="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 text-[11px] leading-tight">
            <span class="text-gray-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Rendered Output:</span>
            <span class="font-bold text-brand-purple">{{ selectedMapping.prefix || '' }}</span>
            <span class="font-medium text-gray-800 dark:text-gray-200">{{ fieldMap.get(selectedMapping.fieldId || '')?.sampleExtractedValue || fieldMap.get(selectedMapping.fieldId || '')?.name || 'Valor' }}</span>
            <span class="font-bold text-brand-purple">{{ selectedMapping.suffix || '' }}</span>
          </div>
        </div>

        <!-- 2. Alignments (Horizontal & Vertical - Word-style symbols) -->
        <div class="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300">
            Content Alignment:
          </label>

          <!-- Horizontal Alignment (Word Symbols) -->
          <div>
            <span class="text-[10px] text-gray-400 block mb-1 font-medium">Horizontal:</span>
            <div class="grid grid-cols-3 gap-1.5 bg-gray-50 dark:bg-gray-800/40 p-1 rounded-xl border border-gray-200 dark:border-gray-700/60">
              <button
                @click="$emit('updateMapping', { ...selectedMapping, horizontalAlign: 'left' })"
                class="flex items-center justify-center py-2 rounded-lg transition-all"
                :class="(selectedMapping.horizontalAlign || 'left') === 'left' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700'"
                title="Align Left"
              >
                <AlignLeft class="w-4 h-4" />
              </button>
              <button
                @click="$emit('updateMapping', { ...selectedMapping, horizontalAlign: 'center' })"
                class="flex items-center justify-center py-2 rounded-lg transition-all"
                :class="selectedMapping.horizontalAlign === 'center' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700'"
                title="Align Center"
              >
                <AlignCenter class="w-4 h-4" />
              </button>
              <button
                @click="$emit('updateMapping', { ...selectedMapping, horizontalAlign: 'right' })"
                class="flex items-center justify-center py-2 rounded-lg transition-all"
                :class="selectedMapping.horizontalAlign === 'right' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700'"
                title="Align Right"
              >
                <AlignRight class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Vertical Alignment (Word/Table Symbols) -->
          <div>
            <span class="text-[10px] text-gray-400 block mb-1 font-medium">Vertical:</span>
            <div class="grid grid-cols-3 gap-1.5 bg-gray-50 dark:bg-gray-800/40 p-1 rounded-xl border border-gray-200 dark:border-gray-700/60">
              <button
                @click="$emit('updateMapping', { ...selectedMapping, verticalAlign: 'top' })"
                class="flex items-center justify-center py-2 rounded-lg transition-all"
                :class="selectedMapping.verticalAlign === 'top' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700'"
                title="Align Top"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="3" x2="21" y2="3" stroke-width="2.5" />
                  <rect x="6" y="8" width="12" height="13" rx="1.5" />
                </svg>
              </button>
              <button
                @click="$emit('updateMapping', { ...selectedMapping, verticalAlign: 'middle' })"
                class="flex items-center justify-center py-2 rounded-lg transition-all"
                :class="(selectedMapping.verticalAlign || 'middle') === 'middle' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700'"
                title="Align Middle (Center)"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" stroke-width="2.5" />
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
              </button>
              <button
                @click="$emit('updateMapping', { ...selectedMapping, verticalAlign: 'bottom' })"
                class="flex items-center justify-center py-2 rounded-lg transition-all"
                :class="selectedMapping.verticalAlign === 'bottom' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700'"
                title="Align Bottom"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="21" x2="21" y2="21" stroke-width="2.5" />
                  <rect x="6" y="3" width="12" height="13" rx="1.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Format and Font Size -->
        <div class="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300">
            Render Format:
          </label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              @click="$emit('updateMapping', { ...selectedMapping, renderFormat: 'TEXT' })"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-xs font-semibold transition-all"
              :class="selectedMapping.renderFormat === 'TEXT' ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'"
            >
              <Type class="w-4 h-4 mb-1" />
              <span>Texto</span>
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

          <div v-if="selectedMapping.renderFormat === 'TEXT'">
            <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Font Size (pt):
            </label>
            <input
              type="number"
              min="7"
              max="24"
              :value="selectedMapping.fontSize || 11"
              @input="$emit('updateMapping', { ...selectedMapping, fontSize: Number(($event.target as HTMLInputElement).value) })"
              class="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>
        </div>

        <!-- 4. Position & Size -->
        <div class="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
              Position & Dimensions (%):
            </label>
            <div v-if="totalPages > 1" class="flex items-center gap-1">
              <span class="text-[10px] text-gray-400">Page:</span>
              <select
                :value="selectedMapping.targetBox.page || 1"
                @change="changeMappingPage(Number(($event.target as HTMLSelectElement).value))"
                class="px-1.5 py-0.5 text-[11px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option v-for="p in totalPages" :key="p" :value="p">Page {{ p }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-4 gap-1.5 text-center">
            <div>
              <label class="text-[9px] uppercase tracking-wider text-gray-400 block font-mono">X (%)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                :value="selectedRenderBox.x"
                @change="updateMappingBoxProp('x', +($event.target as HTMLInputElement).value)"
                class="w-full text-center px-1 py-1 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="text-[9px] uppercase tracking-wider text-gray-400 block font-mono">Y (%)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                :value="selectedRenderBox.y"
                @change="updateMappingBoxProp('y', +($event.target as HTMLInputElement).value)"
                class="w-full text-center px-1 py-1 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="text-[9px] uppercase tracking-wider text-gray-400 block font-mono">W (%)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                :value="selectedRenderBox.width"
                @change="updateMappingBoxProp('width', +($event.target as HTMLInputElement).value)"
                class="w-full text-center px-1 py-1 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="text-[9px] uppercase tracking-wider text-gray-400 block font-mono">H (%)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                :value="selectedRenderBox.height"
                @change="updateMappingBoxProp('height', +($event.target as HTMLInputElement).value)"
                class="w-full text-center px-1 py-1 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Quick Nudge Controls -->
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] text-gray-400">Nudge (+/- 0.5%):</span>
            <div class="flex items-center gap-1">
              <button
                @click="nudgeMapping(-0.5, 0)"
                class="p-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Move 0.5% left"
              >
                <ArrowLeft class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                @click="nudgeMapping(0, -0.5)"
                class="p-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Move 0.5% up"
              >
                <ArrowUp class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                @click="nudgeMapping(0, 0.5)"
                class="p-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Move 0.5% down"
              >
                <ArrowDown class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                @click="nudgeMapping(0.5, 0)"
                class="p-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Move 0.5% right"
              >
                <ArrowRight class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          <div class="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
            <div class="flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
              <MousePointer class="w-3.5 h-3.5 text-brand-purple" />
              <span>Interactive Canvas Controls:</span>
            </div>
            <p>• Drag the box on the canvas to move it.</p>
            <p>• Drag any of the 8 white handles to resize.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
