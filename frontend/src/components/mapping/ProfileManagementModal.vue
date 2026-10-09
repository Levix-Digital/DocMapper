<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  X,
  Download,
  Upload,
  Copy,
  Trash2,
  CheckCircle,
  FolderOpen
} from 'lucide-vue-next';
import type { MappingProfile } from '../../types/mapping';
import {
  getAllProfiles,
  deleteProfile,
  duplicateProfile,
  exportProfileAsDocMapper,
  importProfileFromDocMapper,
  saveProfile,
  BUILTIN_CMR_PROFILE_ID
} from '../../services/mapping/profile-store';
import { useI18n } from '../../i18n';

const { t } = useI18n();

defineProps<{
  show: boolean;
  activeProfileId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectProfile', profile: MappingProfile): void;
  (e: 'profilesUpdated'): void;
}>();

const profiles = ref<MappingProfile[]>([]);
const editingNameId = ref<string | null>(null);
const editedName = ref('');
const notification = ref<string | null>(null);

function refresh() {
  profiles.value = getAllProfiles();
}

onMounted(refresh);

function showNotice(msg: string) {
  notification.value = msg;
  setTimeout(() => {
    notification.value = null;
  }, 3500);
}

function handleSelect(p: MappingProfile) {
  emit('selectProfile', p);
  emit('close');
}

function handleExport(p: MappingProfile) {
  exportProfileAsDocMapper(p);
  showNotice(`Exported ${p.name}.dmap successfully!`);
}

function handleDuplicate(id: string) {
  const cloned = duplicateProfile(id);
  refresh();
  emit('profilesUpdated');
  if (cloned) {
    showNotice(`Created copy: ${cloned.name}`);
  }
}

function handleDelete(id: string) {
  if (confirm('Are you sure you want to delete this profile?')) {
    deleteProfile(id);
    refresh();
    emit('profilesUpdated');
    showNotice('Profile deleted.');
  }
}

function startRename(p: MappingProfile) {
  if (p.id === BUILTIN_CMR_PROFILE_ID) return;
  editingNameId.value = p.id;
  editedName.value = p.name;
}

function saveRename(p: MappingProfile) {
  if (editedName.value.trim() && editedName.value.trim() !== p.name) {
    p.name = editedName.value.trim();
    saveProfile(p);
    refresh();
    emit('profilesUpdated');
  }
  editingNameId.value = null;
}

async function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = importProfileFromDocMapper(text);
    refresh();
    emit('profilesUpdated');
    emit('selectProfile', imported);
    showNotice(`Imported profile "${imported.name}" ready for use!`);
  } catch (err: any) {
    alert(`Failed to import .dmap file: ${err?.message || err}`);
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <FolderOpen class="w-5 h-5 text-brand-purple" />
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('profileModal.title') }}</h3>
            <p class="text-xs text-gray-500">{{ t('profileModal.subtitle') }}</p>
          </div>
        </div>

        <button
          @click="$emit('close')"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Notification Toast -->
      <div
        v-if="notification"
        class="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 px-6 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"
      >
        <CheckCircle class="w-4 h-4" />
        <span>{{ notification }}</span>
      </div>

      <!-- Action Bar -->
      <div class="px-6 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <span class="text-xs text-gray-500">
          {{ profiles.length }} Profiles in local browser storage
        </span>

        <!-- Import Button -->
        <label class="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm transition-all">
          <Upload class="w-3.5 h-3.5 text-brand-purple" />
          <span>{{ t('profileModal.import') }}</span>
          <input type="file" accept=".dmap,.docmapper,application/json" class="hidden" @change="handleImportFile" />
        </label>
      </div>

      <!-- Profile Cards List -->
      <div class="p-6 overflow-y-auto space-y-3 flex-grow">
        <div
          v-for="p in profiles"
          :key="p.id"
          class="p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          :class="[
            activeProfileId === p.id
              ? 'border-brand-purple bg-purple-50/40 dark:bg-purple-950/20 shadow-sm'
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
          ]"
        >
          <div>
            <!-- Name or Rename input -->
            <div v-if="editingNameId === p.id" class="flex items-center gap-2">
              <input
                v-model="editedName"
                class="px-2 py-1 text-sm rounded border border-brand-purple bg-white dark:bg-gray-800 font-semibold text-gray-900 dark:text-white"
                @keyup.enter="saveRename(p)"
              />
              <button
                @click="saveRename(p)"
                class="text-xs px-2 py-1 bg-brand-purple text-white rounded font-medium"
              >
                Save
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <h4
                class="font-bold text-sm text-gray-900 dark:text-white cursor-pointer hover:underline"
                @click="startRename(p)"
                title="Click to rename"
              >
                {{ p.name }}
              </h4>
              <span
                v-if="p.id === BUILTIN_CMR_PROFILE_ID"
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                Built-in
              </span>
              <span
                v-if="activeProfileId === p.id"
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/15 text-brand-purple dark:text-purple-300"
              >
                Active
              </span>
            </div>

            <p class="text-xs text-gray-500 mt-1">
              {{ p.fields.length }} Extracted Fields • {{ p.destinationMappings.length }} Target Placements • Updated {{ new Date(p.updatedAt).toLocaleDateString() }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              v-if="activeProfileId !== p.id"
              @click="handleSelect(p)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-brand-purple hover:text-white transition-all text-gray-700 dark:text-gray-300"
            >
              {{ t('profileModal.switchProfile') }}
            </button>

            <!-- Export .dmap -->
            <button
              @click="handleExport(p)"
              class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              :title="t('profileModal.export')"
            >
              <Download class="w-4 h-4" />
            </button>

            <!-- Duplicate -->
            <button
              @click="handleDuplicate(p.id)"
              class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              :title="t('profileModal.duplicate')"
            >
              <Copy class="w-4 h-4" />
            </button>

            <!-- Delete -->
            <button
              v-if="p.id !== BUILTIN_CMR_PROFILE_ID"
              @click="handleDelete(p.id)"
              class="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500"
              :title="t('profileModal.delete')"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
