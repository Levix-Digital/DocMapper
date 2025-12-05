<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">IKEA Receipt Generator</h1>

    <!-- Drag & Drop Area -->
    <div
      class="border-4 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
      @dragover.prevent
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="application/pdf"
        class="hidden"
        @change="handleFileSelect"
      />
      <div v-if="isProcessing" class="text-gray-600">
        <p class="text-lg animate-pulse">Processing...</p>
      </div>
      <div v-else>
        <p class="text-xl text-gray-700 mb-2">Drag & Drop CMR PDFs here</p>
        <p class="text-sm text-gray-500">or click to select files</p>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mt-4 p-4 bg-red-100 text-red-700 rounded">
      {{ error }}
    </div>

    <!-- Results -->
    <div v-if="results.length > 0" class="mt-8">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Generated Receipts ({{ results.length }})</h2>
        <button
          @click="downloadAll"
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition flex items-center gap-2"
        >
          Download All (ZIP)
        </button>
      </div>

      <div class="bg-white shadow rounded-lg divide-y">
        <div v-for="res in results" :key="res.fileName" class="p-4 flex justify-between items-center">
          <div>
            <p class="font-medium">{{ res.fileName }}</p>
            <p class="text-sm text-gray-500">
              Shipment: {{ res.data.shipment }} | Seal: {{ res.data.seal }}
            </p>
          </div>
          <button
            @click="downloadOne(res)"
            class="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { extractCMRData } from '../modules/cmr/extractor';
import { generateReceiptPdf } from '../services/pdf/template-engine';
import { ProcessingResult } from '../modules/cmr/types';

// Set worker source (using local file if possible, or CDN as fallback/default setup)
// Adjust path as needed based on your build setup. 
// For Vite, usually: import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const isProcessing = ref(false);
const error = ref<string | null>(null);
const results = ref<ProcessingResult[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
    fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files) processFiles(Array.from(files));
};

const handleDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files;
  if (files) processFiles(Array.from(files));
};

const processFiles = async (files: File[]) => {
  isProcessing.value = true;
  error.value = null;
  
  // Clear previous results? Or append? Let's append for "Batch" feel, or clear if user wants fresh start.
  // Let's clear for MVP simplicity to avoid duplicates.
  results.value = [];

  try {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        
        const data = extractCMRData(text);

        if (data.shipment) {
          try {
            const pdfBytes = await generateReceiptPdf(data);
            // CAST: Avoiding TS2322 by casting pdfBytes (Uint8Array) to any or specifically acceptable type
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            
            results.value.push({
              fileName: `${data.shipment}.pdf`,
              blob,
              data
            });
          } catch (err) {
            console.error('Generation failed for page', i, err);
          }
        }
      }
    }
    
    if (results.value.length === 0) {
      error.value = "No valid CMR data found in the uploaded files.";
    }

  } catch (err) {
    console.error(err);
    error.value = "An error occurred while processing files.";
  } finally {
    isProcessing.value = false;
    if (fileInput.value) fileInput.value.value = ''; // Reset input
  }
};

const downloadOne = (res: ProcessingResult) => {
  saveAs(res.blob, res.fileName);
};

const downloadAll = async () => {
  const zip = new JSZip();
  results.value.forEach(res => {
    zip.file(res.fileName, res.blob);
  });
  
  // Add CSV summary
  const csvHeader = "Shipment,Seal,Trailer,Consignments,Arrival Date,Arrival Time\n";
  const csvRows = results.value.map(r => 
    `${r.data.shipment},${r.data.seal},${r.data.trailer},"${r.data.consignments}",${r.data.est_arrival_date},${r.data.est_arrival_time}`
  ).join("\n");
  zip.file("summary.csv", csvHeader + csvRows);

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "ikea_receipts.zip");
};
</script>
