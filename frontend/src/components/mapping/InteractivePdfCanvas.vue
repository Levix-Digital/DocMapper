<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, toRaw, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2 } from 'lucide-vue-next';
import type { BoundingBox, FieldDefinition } from '../../types/mapping';
import { useI18n } from '../../i18n';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    pdfDocument: any | null;
    fields: FieldDefinition[];
    selectedFieldId: string | null;
    activeDrawingType: 'value' | 'label' | 'none';
    activeColor?: string;
  }>(),
  {
    activeDrawingType: 'none',
    activeColor: '#6366f1',
  }
);

const emit = defineEmits<{
  (e: 'boxDrawn', box: BoundingBox, type: 'value' | 'label'): void;
  (e: 'selectField', fieldId: string): void;
  (e: 'updateBox', fieldId: string, type: 'value' | 'label', box: BoundingBox): void;
  (e: 'deleteBox', fieldId: string, type: 'value' | 'label'): void;
}>();

const currentPage = ref(1);
const scale = ref(1.35);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const isRendering = ref(false);
let currentRenderTask: any = null;

const totalPages = computed(() => {
  const rawPdf = toRaw(props.pdfDocument);
  return rawPdf?.numPages || 1;
});

// Interaction state
const isDrawing = ref(false);
const drawStart = ref<{ x: number; y: number } | null>(null);
const drawCurrent = ref<{ x: number; y: number } | null>(null);

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

interface ActiveOriginTransform {
  fieldId: string;
  type: 'value' | 'label';
  mode: 'move' | 'resize';
  handle?: ResizeHandle;
  initialBox: BoundingBox;
  currentBox: BoundingBox;
  startPercent: { x: number; y: number };
}

// Local transform state for 60 FPS silky smooth movement
const activeTransform = ref<ActiveOriginTransform | null>(null);
const selectedBoxType = ref<'value' | 'label' | null>(null);

const activeBoxesOnPage = computed(() => {
  const result: Array<{
    field: FieldDefinition;
    type: 'value' | 'label';
    box: BoundingBox;
    isSelected: boolean;
  }> = [];

  for (const f of props.fields) {
    if (f.valueBox && f.valueBox.page === currentPage.value) {
      result.push({
        field: f,
        type: 'value',
        box: f.valueBox,
        isSelected: f.id === props.selectedFieldId,
      });
    }
    if (f.labelBox && f.labelBox.page === currentPage.value) {
      result.push({
        field: f,
        type: 'label',
        box: f.labelBox,
        isSelected: f.id === props.selectedFieldId,
      });
    }
  }

  return result;
});

function getBoxToRender(item: { field: FieldDefinition; type: 'value' | 'label'; box: BoundingBox }): BoundingBox {
  if (
    activeTransform.value &&
    activeTransform.value.fieldId === item.field.id &&
    activeTransform.value.type === item.type
  ) {
    return activeTransform.value.currentBox;
  }
  return item.box;
}

const activeSelectedBoxItem = computed(() => {
  const selectedBoxes = activeBoxesOnPage.value.filter(b => b.isSelected);
  if (selectedBoxes.length === 0) return null;
  if (selectedBoxType.value) {
    const match = selectedBoxes.find(b => b.type === selectedBoxType.value);
    if (match) return match;
  }
  return selectedBoxes[0];
});

const activeSelectedRenderBox = computed<BoundingBox>(() => {
  if (!activeSelectedBoxItem.value) {
    return { x: 0, y: 0, width: 0, height: 0, page: 1 };
  }
  return getBoxToRender(activeSelectedBoxItem.value);
});

// Render PDF Page
async function renderCurrentPage() {
  const rawPdf = toRaw(props.pdfDocument);
  if (!rawPdf || !canvasRef.value) return;

  if (currentRenderTask) {
    try {
      currentRenderTask.cancel();
    } catch (_) {}
    currentRenderTask = null;
  }

  try {
    isRendering.value = true;
    const page = await rawPdf.getPage(currentPage.value);
    const viewport = page.getViewport({ scale: scale.value });

    const canvas = canvasRef.value;
    const context = canvas.getContext('2d');
    if (!context) return;

    const w = Math.floor(viewport.width);
    const h = Math.floor(viewport.height);

    canvas.width = w;
    canvas.height = h;
    canvasWidth.value = w;
    canvasHeight.value = h;

    const renderTask = page.render({
      canvasContext: context,
      viewport: viewport,
    });
    currentRenderTask = renderTask;
    await renderTask.promise;
    currentRenderTask = null;
  } catch (err: any) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error('Error rendering PDF page on canvas:', err);
    }
  } finally {
    isRendering.value = false;
  }
}

watch(() => props.pdfDocument, () => {
  currentPage.value = 1;
  nextTick(renderCurrentPage);
});

watch([currentPage, scale], () => {
  nextTick(renderCurrentPage);
});

onMounted(() => {
  renderCurrentPage();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function handleKeyDown(e: KeyboardEvent) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && props.selectedFieldId) {
    // Check if user is typing in an input
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    emit('deleteBox', props.selectedFieldId, 'value');
  }
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--;
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++;
}

function zoomIn() {
  if (scale.value < 2.5) scale.value += 0.25;
}

function zoomOut() {
  if (scale.value > 0.75) scale.value -= 0.25;
}

// Coordinate conversions
function getRelativeCoords(e: MouseEvent): { xPercent: number; yPercent: number } | null {
  if (!svgRef.value) return null;
  const rect = svgRef.value.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;

  const xPercent = Math.min(Math.max((rawX / rect.width) * 100, 0), 100);
  const yPercent = Math.min(Math.max((rawY / rect.height) * 100, 0), 100);

  return { xPercent, yPercent };
}

// Mouse Handlers
function onCanvasMouseDown(e: MouseEvent) {
  if (props.activeDrawingType === 'none') {
    selectedBoxType.value = null;
    return;
  }
  const coords = getRelativeCoords(e);
  if (!coords) return;

  isDrawing.value = true;
  drawStart.value = { x: coords.xPercent, y: coords.yPercent };
  drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
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
  if (isDrawing.value && drawStart.value && drawCurrent.value && props.activeDrawingType !== 'none') {
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
      emit('boxDrawn', newBox, props.activeDrawingType);
    }
  }

  isDrawing.value = false;
  drawStart.value = null;
  drawCurrent.value = null;
}

function startMove(
  e: MouseEvent,
  fieldId: string,
  type: 'value' | 'label',
  box: BoundingBox
) {
  if (props.activeDrawingType !== 'none') return;
  e.stopPropagation();
  emit('selectField', fieldId);
  selectedBoxType.value = type;

  const coords = getRelativeCoords(e);
  if (!coords) return;

  const cur = { ...box };
  activeTransform.value = {
    fieldId,
    type,
    mode: 'move',
    initialBox: { ...cur },
    currentBox: { ...cur },
    startPercent: { x: coords.xPercent, y: coords.yPercent },
  };

  window.addEventListener('mousemove', onGlobalMouseMove, { passive: false });
  window.addEventListener('mouseup', onGlobalMouseUp);
}

function startResize(
  e: MouseEvent,
  fieldId: string,
  type: 'value' | 'label',
  handle: ResizeHandle,
  box: BoundingBox
) {
  e.stopPropagation();
  emit('selectField', fieldId);
  selectedBoxType.value = type;

  const coords = getRelativeCoords(e);
  if (!coords) return;

  const cur = { ...box };
  activeTransform.value = {
    fieldId,
    type,
    mode: 'resize',
    handle,
    initialBox: { ...cur },
    currentBox: { ...cur },
    startPercent: { x: coords.xPercent, y: coords.yPercent },
  };

  window.addEventListener('mousemove', onGlobalMouseMove, { passive: false });
  window.addEventListener('mouseup', onGlobalMouseUp);
}

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

    // Horizontal
    if (handle.includes('w')) {
      const targetX = initialBox.x + deltaX;
      const maxX = initialBox.x + initialBox.width - 0.5;
      newX = Math.max(0, Math.min(targetX, maxX));
      newW = initialBox.x + initialBox.width - newX;
    } else if (handle.includes('e')) {
      const targetW = initialBox.width + deltaX;
      newW = Math.max(0.5, Math.min(targetW, 100 - initialBox.x));
    }

    // Vertical
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

function onGlobalMouseUp() {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);

  if (!activeTransform.value) return;

  const { fieldId, type, currentBox, initialBox } = activeTransform.value;
  activeTransform.value = null;

  if (
    currentBox.x !== initialBox.x ||
    currentBox.y !== initialBox.y ||
    currentBox.width !== initialBox.width ||
    currentBox.height !== initialBox.height
  ) {
    emit('updateBox', fieldId, type, { ...currentBox });
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

// Compute drawing preview box
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
  <div class="w-full max-w-full flex flex-col items-stretch bg-gray-100 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 select-none overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center justify-between w-full max-w-4xl mx-auto mb-4 px-2 flex-shrink-0">
      <!-- Page Navigation -->
      <div class="flex items-center gap-2">
        <button
          @click="prevPage"
          :disabled="currentPage <= 1"
          class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          :title="t('origin.prevPage')"
        >
          <ChevronLeft class="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('origin.pageNav', { current: currentPage, total: totalPages }) }}
        </span>
        <button
          @click="nextPage"
          :disabled="currentPage >= totalPages"
          class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          :title="t('origin.nextPage')"
        >
          <ChevronRight class="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <!-- Instructions & Mode Badge -->
      <div class="flex items-center gap-2 text-xs">
        <span
          v-if="activeDrawingType !== 'none'"
          class="px-2.5 py-1 rounded-full font-semibold animate-pulse"
          :style="{ backgroundColor: `${activeColor}20`, color: activeColor, borderColor: activeColor }"
        >
          {{ activeDrawingType === 'value' ? t('origin.modeValue') : t('origin.modeLabel') }}
        </span>
        <span v-else class="text-gray-500 dark:text-gray-400">
          {{ t('origin.promptDraw') }}
        </span>
      </div>

      <!-- Zoom & Delete Controls -->
      <div class="flex items-center gap-2">
        <button
          @click="zoomOut"
          :disabled="scale <= 0.75"
          class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          :title="t('origin.zoomOut')"
        >
          <ZoomOut class="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
          {{ Math.round(scale * 100) }}%
        </span>
        <button
          @click="zoomIn"
          :disabled="scale >= 2.5"
          class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          :title="t('origin.zoomIn')"
        >
          <ZoomIn class="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          v-if="selectedFieldId"
          @click="$emit('deleteBox', selectedFieldId, 'value')"
          class="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors ml-2"
          :title="t('origin.deleteSelected')"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Canvas Container Scroll Wrapper (Safe-centered: centers when smaller, left-aligned with horizontal scroll when zoomed) -->
    <div class="w-full overflow-auto max-h-[calc(100vh-230px)] p-2">
      <div
        class="relative shadow-2xl rounded-lg overflow-hidden border border-gray-300 dark:border-gray-800 bg-white mx-auto flex-shrink-0"
        :style="{
          width: canvasWidth ? `${canvasWidth}px` : 'auto',
          height: canvasHeight ? `${canvasHeight}px` : 'auto'
        }"
        :class="activeDrawingType !== 'none' ? 'cursor-crosshair' : 'cursor-default'"
      >
        <!-- Base PDF Canvas -->
        <canvas
          ref="canvasRef"
          class="block"
          :style="{
            width: canvasWidth ? `${canvasWidth}px` : 'auto',
            height: canvasHeight ? `${canvasHeight}px` : 'auto'
          }"
        ></canvas>

        <!-- Reactive SVG Overlay -->
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
          <!-- 1. Drawn Boxes on page -->
          <g
            v-for="item in activeBoxesOnPage"
            :key="`${item.field.id}-${item.type}`"
            class="group cursor-grab active:cursor-grabbing"
            @mousedown="startMove($event, item.field.id, item.type, getBoxToRender(item))"
          >
            <rect
              :x="(getBoxToRender(item).x * canvasWidth) / 100"
              :y="(getBoxToRender(item).y * canvasHeight) / 100"
              :width="(getBoxToRender(item).width * canvasWidth) / 100"
              :height="(getBoxToRender(item).height * canvasHeight) / 100"
              :fill="item.field.color"
              :fill-opacity="item.isSelected ? 0.3 : 0.12"
              :stroke="item.field.color"
              :stroke-width="item.isSelected ? 2 : 1.5"
              :stroke-dasharray="item.type === 'label' ? '4,4' : 'none'"
              rx="3"
            />

            <!-- Tag Label -->
            <text
              :x="(getBoxToRender(item).x * canvasWidth) / 100"
              :y="Math.max(((getBoxToRender(item).y * canvasHeight) / 100) - 6, 14)"
              :fill="item.field.color"
              font-size="11"
              font-weight="bold"
              class="select-none pointer-events-none drop-shadow-sm font-sans"
            >
              {{ item.type === 'label' ? '[Label]' : '[Value]' }} {{ item.field.name }}
            </text>
          </g>

          <!-- 2. TOP-LAYER SELECTION & 8-HANDLE RESIZING OVERLAY (Always on top) -->
          <g
            v-if="activeSelectedBoxItem"
            class="pointer-events-auto"
          >
            <!-- Highlight Ring -->
            <rect
              :x="(activeSelectedRenderBox.x * canvasWidth) / 100 - 1"
              :y="(activeSelectedRenderBox.y * canvasHeight) / 100 - 1"
              :width="(activeSelectedRenderBox.width * canvasWidth) / 100 + 2"
              :height="(activeSelectedRenderBox.height * canvasHeight) / 100 + 2"
              fill="none"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2"
              stroke-dasharray="4,3"
              rx="4"
              class="pointer-events-none"
            />

            <!-- NW Handle -->
            <circle
              :cx="(activeSelectedRenderBox.x * canvasWidth) / 100"
              :cy="(activeSelectedRenderBox.y * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-nwse-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'nw', activeSelectedRenderBox)"
            />
            <circle
              :cx="(activeSelectedRenderBox.x * canvasWidth) / 100"
              :cy="(activeSelectedRenderBox.y * canvasHeight) / 100"
              r="6"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2.5"
              class="cursor-nwse-resize pointer-events-none drop-shadow-md"
            />

            <!-- N Handle -->
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width / 2) * canvasWidth) / 100"
              :cy="(activeSelectedRenderBox.y * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-ns-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'n', activeSelectedRenderBox)"
            />
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width / 2) * canvasWidth) / 100"
              :cy="(activeSelectedRenderBox.y * canvasHeight) / 100"
              r="5"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2"
              class="cursor-ns-resize pointer-events-none drop-shadow-md"
            />

            <!-- NE Handle -->
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width) * canvasWidth) / 100"
              :cy="(activeSelectedRenderBox.y * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-nesw-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'ne', activeSelectedRenderBox)"
            />
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width) * canvasWidth) / 100"
              :cy="(activeSelectedRenderBox.y * canvasHeight) / 100"
              r="6"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2.5"
              class="cursor-nesw-resize pointer-events-none drop-shadow-md"
            />

            <!-- E Handle -->
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width) * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height / 2) * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-ew-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'e', activeSelectedRenderBox)"
            />
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width) * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height / 2) * canvasHeight) / 100"
              r="5"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2"
              class="cursor-ew-resize pointer-events-none drop-shadow-md"
            />

            <!-- SE Handle -->
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width) * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height) * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-nwse-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'se', activeSelectedRenderBox)"
            />
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width) * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height) * canvasHeight) / 100"
              r="6"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2.5"
              class="cursor-nwse-resize pointer-events-none drop-shadow-md"
            />

            <!-- S Handle -->
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width / 2) * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height) * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-ns-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 's', activeSelectedRenderBox)"
            />
            <circle
              :cx="((activeSelectedRenderBox.x + activeSelectedRenderBox.width / 2) * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height) * canvasHeight) / 100"
              r="5"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2"
              class="cursor-ns-resize pointer-events-none drop-shadow-md"
            />

            <!-- SW Handle -->
            <circle
              :cx="(activeSelectedRenderBox.x * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height) * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-nesw-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'sw', activeSelectedRenderBox)"
            />
            <circle
              :cx="(activeSelectedRenderBox.x * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height) * canvasHeight) / 100"
              r="6"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2.5"
              class="cursor-nesw-resize pointer-events-none drop-shadow-md"
            />

            <!-- W Handle -->
            <circle
              :cx="(activeSelectedRenderBox.x * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height / 2) * canvasHeight) / 100"
              r="14"
              fill="transparent"
              class="cursor-ew-resize"
              @mousedown.stop="startResize($event, activeSelectedBoxItem.field.id, activeSelectedBoxItem.type, 'w', activeSelectedRenderBox)"
            />
            <circle
              :cx="(activeSelectedRenderBox.x * canvasWidth) / 100"
              :cy="((activeSelectedRenderBox.y + activeSelectedRenderBox.height / 2) * canvasHeight) / 100"
              r="5"
              fill="#ffffff"
              :stroke="activeSelectedBoxItem.field.color"
              stroke-width="2"
              class="cursor-ew-resize pointer-events-none drop-shadow-md"
            />
          </g>

          <!-- Draft Drawing Box Preview -->
          <rect
            v-if="draftBoxStyle"
            :x="draftBoxStyle.x"
            :y="draftBoxStyle.y"
            :width="draftBoxStyle.width"
            :height="draftBoxStyle.height"
            :fill="activeColor"
            fill-opacity="0.2"
            :stroke="activeColor"
            stroke-width="2"
            :stroke-dasharray="activeDrawingType === 'label' ? '4,4' : 'none'"
          />
        </svg>
      </div>
    </div>
  </div>
</template>
