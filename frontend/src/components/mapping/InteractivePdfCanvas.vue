<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, toRaw, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2 } from 'lucide-vue-next';
import type { BoundingBox, FieldDefinition } from '../../types/mapping';

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

// Moving state
const movingTarget = ref<{
  fieldId: string;
  type: 'value' | 'label';
  initialBox: BoundingBox;
  startCoords: { x: number; y: number };
} | null>(null);

// Resizing state
const resizingTarget = ref<{
  fieldId: string;
  type: 'value' | 'label';
  handle: 'nw' | 'ne' | 'se' | 'sw';
  initialBox: BoundingBox;
} | null>(null);

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
function onMouseDown(e: MouseEvent) {
  if (props.activeDrawingType === 'none') return;
  const coords = getRelativeCoords(e);
  if (!coords) return;

  isDrawing.value = true;
  drawStart.value = { x: coords.xPercent, y: coords.yPercent };
  drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
}

function onMouseMove(e: MouseEvent) {
  const coords = getRelativeCoords(e);
  if (!coords) return;

  if (isDrawing.value && drawStart.value) {
    drawCurrent.value = { x: coords.xPercent, y: coords.yPercent };
  } else if (resizingTarget.value) {
    handleResizing(coords.xPercent, coords.yPercent);
  } else if (movingTarget.value) {
    handleMoving(coords.xPercent, coords.yPercent);
  }
}

function onMouseUp() {
  if (isDrawing.value && drawStart.value && drawCurrent.value && props.activeDrawingType !== 'none') {
    const minX = Math.min(drawStart.value.x, drawCurrent.value.x);
    const maxX = Math.max(drawStart.value.x, drawCurrent.value.x);
    const minY = Math.min(drawStart.value.y, drawCurrent.value.y);
    const maxY = Math.max(drawStart.value.y, drawCurrent.value.y);

    const width = maxX - minX;
    const height = maxY - minY;

    // Minimum size filter (0.5% of page)
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
  resizingTarget.value = null;
  movingTarget.value = null;
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
  const coords = getRelativeCoords(e);
  if (!coords) return;
  movingTarget.value = {
    fieldId,
    type,
    initialBox: { ...box },
    startCoords: { x: coords.xPercent, y: coords.yPercent },
  };
}

function handleMoving(currX: number, currY: number) {
  if (!movingTarget.value) return;
  const { fieldId, type, initialBox, startCoords } = movingTarget.value;
  const deltaX = currX - startCoords.x;
  const deltaY = currY - startCoords.y;

  const newX = Math.min(Math.max(initialBox.x + deltaX, 0), 100 - initialBox.width);
  const newY = Math.min(Math.max(initialBox.y + deltaY, 0), 100 - initialBox.height);

  const updatedBox: BoundingBox = {
    ...initialBox,
    x: Number(newX.toFixed(2)),
    y: Number(newY.toFixed(2)),
  };
  emit('updateBox', fieldId, type, updatedBox);
}

// Start resize from handle
function startResize(
  e: MouseEvent,
  fieldId: string,
  type: 'value' | 'label',
  handle: 'nw' | 'ne' | 'se' | 'sw',
  box: BoundingBox
) {
  e.stopPropagation();
  resizingTarget.value = {
    fieldId,
    type,
    handle,
    initialBox: { ...box },
  };
}

function handleResizing(currX: number, currY: number) {
  if (!resizingTarget.value) return;
  const { fieldId, type, handle, initialBox } = resizingTarget.value;

  let newX = initialBox.x;
  let newY = initialBox.y;
  let newW = initialBox.width;
  let newH = initialBox.height;

  if (handle === 'nw') {
    newW = initialBox.x + initialBox.width - currX;
    newH = initialBox.y + initialBox.height - currY;
    newX = currX;
    newY = currY;
  } else if (handle === 'ne') {
    newW = currX - initialBox.x;
    newH = initialBox.y + initialBox.height - currY;
    newY = currY;
  } else if (handle === 'se') {
    newW = currX - initialBox.x;
    newH = currY - initialBox.y;
  } else if (handle === 'sw') {
    newW = initialBox.x + initialBox.width - currX;
    newX = currX;
    newH = currY - initialBox.y;
  }

  if (newW > 0.5 && newH > 0.5) {
    const updatedBox: BoundingBox = {
      x: Number(newX.toFixed(2)),
      y: Number(newY.toFixed(2)),
      width: Number(newW.toFixed(2)),
      height: Number(newH.toFixed(2)),
      page: currentPage.value,
    };
    emit('updateBox', fieldId, type, updatedBox);
  }
}

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
          title="Previous Page"
        >
          <ChevronLeft class="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Page {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          @click="nextPage"
          :disabled="currentPage >= totalPages"
          class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          title="Next Page"
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
          Drawing Mode: {{ activeDrawingType === 'value' ? 'Value Box [Solid]' : 'Label Box [Dashed]' }}
        </span>
        <span v-else class="text-gray-500 dark:text-gray-400">
          Click a field in the drawer to draw its bounding box
        </span>
      </div>

      <!-- Zoom & Delete Controls -->
      <div class="flex items-center gap-2">
        <button
          @click="zoomOut"
          :disabled="scale <= 0.75"
          class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          title="Zoom Out"
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
          title="Zoom In"
        >
          <ZoomIn class="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          v-if="selectedFieldId"
          @click="$emit('deleteBox', selectedFieldId, 'value')"
          class="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors ml-2"
          title="Delete selected field boxes"
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
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
        >
          <!-- Drawn Boxes -->
          <g
            v-for="item in activeBoxesOnPage"
            :key="`${item.field.id}-${item.type}`"
            @mousedown.stop="$emit('selectField', item.field.id)"
            class="cursor-pointer group"
          >
            <rect
              :x="(item.box.x * canvasWidth) / 100"
              :y="(item.box.y * canvasHeight) / 100"
              :width="(item.box.width * canvasWidth) / 100"
              :height="(item.box.height * canvasHeight) / 100"
              :fill="item.field.color"
              :fill-opacity="item.isSelected ? 0.25 : 0.12"
              :stroke="item.field.color"
              :stroke-width="item.isSelected ? 2.5 : 1.5"
              :stroke-dasharray="item.type === 'label' ? '4,4' : 'none'"
              :class="activeDrawingType === 'none' ? 'cursor-move' : 'cursor-crosshair'"
              @mousedown="startMove($event, item.field.id, item.type, item.box)"
            />

            <!-- Tag Label -->
            <text
              :x="(item.box.x * canvasWidth) / 100"
              :y="Math.max(((item.box.y * canvasHeight) / 100) - 6, 14)"
              :fill="item.field.color"
              font-size="11"
              font-weight="bold"
              class="select-none pointer-events-none drop-shadow-sm font-sans"
            >
              {{ item.type === 'label' ? '[Label]' : '[Value]' }} {{ item.field.name }}
            </text>

            <!-- Corner Handles for Resizing (if selected) -->
            <template v-if="item.isSelected">
              <!-- NW -->
              <rect
                :x="((item.box.x * canvasWidth) / 100) - 4"
                :y="((item.box.y * canvasHeight) / 100) - 4"
                width="8"
                height="8"
                :fill="item.field.color"
                class="cursor-nw-resize"
                @mousedown="startResize($event, item.field.id, item.type, 'nw', item.box)"
              />
              <!-- NE -->
              <rect
                :x="(((item.box.x + item.box.width) * canvasWidth) / 100) - 4"
                :y="((item.box.y * canvasHeight) / 100) - 4"
                width="8"
                height="8"
                :fill="item.field.color"
                class="cursor-ne-resize"
                @mousedown="startResize($event, item.field.id, item.type, 'ne', item.box)"
              />
              <!-- SE -->
              <rect
                :x="(((item.box.x + item.box.width) * canvasWidth) / 100) - 4"
                :y="(((item.box.y + item.box.height) * canvasHeight) / 100) - 4"
                width="8"
                height="8"
                :fill="item.field.color"
                class="cursor-se-resize"
                @mousedown="startResize($event, item.field.id, item.type, 'se', item.box)"
              />
              <!-- SW -->
              <rect
                :x="((item.box.x * canvasWidth) / 100) - 4"
                :y="(((item.box.y + item.box.height) * canvasHeight) / 100) - 4"
                width="8"
                height="8"
                :fill="item.field.color"
                class="cursor-sw-resize"
                @mousedown="startResize($event, item.field.id, item.type, 'sw', item.box)"
              />
            </template>
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
