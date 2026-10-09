<script setup lang="ts">
import Editor from './views/Editor.vue';
import MappingStudio from './views/MappingStudio.vue';
import MainLayout from './components/layout/MainLayout.vue';
import { useRouter } from './composables/useRouter';

const { currentRoute } = useRouter();
</script>

<template>
  <MainLayout>
    <Editor v-if="currentRoute === 'processor'" />
    <MappingStudio v-else-if="currentRoute === 'mapping'" />
  </MainLayout>
</template>
