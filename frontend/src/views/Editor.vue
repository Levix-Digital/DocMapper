<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <!-- Header Section -->
    <div class="text-center space-y-2">
      <h1 class="text-4xl font-bold font-heading text-gray-900 dark:text-white">Document Processor</h1>
      <p class="text-gray-500 dark:text-gray-400">Secure, client-side generation. No data leaves your machine.</p>
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
        accept="application/pdf"
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
                <p class="text-sm text-gray-500">Decrypting matrix patterns</p>
            </div>
            <div v-else>
                <p class="text-xl font-medium text-gray-900 dark:text-white">Drop CMR PDFs here</p>
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

    <!-- Results -->
    <div v-if="results.length > 0" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="flex justify-between items-end border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Output Stream</h2>
          <p class="text-sm text-gray-500">{{ results.length }} documents generated</p>
        </div>
        <Button variant="primary" @click="downloadAll">
            <template #icon><Download class="w-4 h-4" /></template>
            Download All (ZIP)
        </Button>
      </div>

      <div class="grid gap-3">
        <Card 
            v-for="res in results" 
            :key="res.fileName" 
            class="flex justify-between items-center group !p-3 hover:border-brand-green"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-brand-green">
                <FileCheck class="w-5 h-5" />
            </div>
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ res.fileName }}</p>
              <div class="flex gap-2 text-xs text-gray-500 font-mono mt-0.5">
                <span>SHIP:{{ res.data.shipment }}</span>
                <span class="text-gray-300">|</span>
                <span>SEAL:{{ res.data.seal }}</span>
              </div>
            </div>
          </div>
          
          <Button variant="ghost" @click="downloadOne(res)">
            <Download class="w-4 h-4" />
          </Button>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { UploadCloud, FileCheck, Download, Loader2, AlertCircle } from 'lucide-vue-next';

import Card from '../components/ui/Card.vue';
import Button from '../components/ui/Button.vue';
import { extractCMRData } from '../modules/cmr/extractor';
import { generateShipmentDocsPdf } from '../services/pdf/template-engine';
import { ProcessingResult } from '../modules/cmr/types';

// Set worker source using Vite's ?url import for reliable local loading
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const isProcessing = ref(false);
const isDragging = ref(false);
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
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files) processFiles(Array.from(files));
};

const processFiles = async (files: File[]) => {
  isProcessing.value = true;
  error.value = null;
  results.value = [];

  try {
    const validFiles = files.filter(f => f.type === 'application/pdf');
    if (validFiles.length === 0) throw new Error("Please upload valid PDF files.");

    for (const file of validFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        
        const data = extractCMRData(text);

        if (data.shipment) {
          try {
            const pdfBytes = await generateShipmentDocsPdf(data);
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
      error.value = "No valid CMR data found in the uploaded files. Ensure format matches standard.";
    }

  } catch (err: any) {
    console.error(err);
    error.value = err.message || "An error occurred while processing files.";
  } finally {
    isProcessing.value = false;
    if (fileInput.value) fileInput.value.value = ''; 
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
  saveAs(content, "documents.zip");
};
</script>
