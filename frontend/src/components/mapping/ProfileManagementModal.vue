<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  X,
  Download,
  Upload,
  Copy,
  Trash2,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  Pencil
} from 'lucide-vue-next';
import type { MappingProfile } from '../../types/mapping';
import { profileService } from '../../services/mapping/profile-service';
import { useI18n } from '../../i18n';

const { t } = useI18n();

defineProps<{
  show: boolean;
  activeProfileId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectProfile', profile: MappingProfile): void;
  (e: 'editProfile', profile: MappingProfile): void;
  (e: 'profilesUpdated'): void;
}>();

const profiles = ref<MappingProfile[]>([]);
const editingNameId = ref<string | null>(null);
const editedName = ref('');
const notification = ref<string | null>(null);
const notificationIsError = ref(false);
/** Profile whose delete button was clicked once; a second click deletes it. */
const pendingDeleteId = ref<string | null>(null);

// Browser dialogs (alert, confirm) do not show in the desktop window, so
// errors and the delete confirmation are shown inside the window.
function showError(err: any) {
  showNotice(err?.message || String(err));
  notificationIsError.value = true;
}

async function refresh() {
  try {
    profiles.value = await profileService.getAllProfiles();
  } catch (err: any) {
    showError(err);
  }
}

onMounted(refresh);

function showNotice(msg: string) {
  notification.value = msg;
  notificationIsError.value = false;
  setTimeout(() => {
    notification.value = null;
  }, 3500);
}

function handleEdit(p: MappingProfile) {
  emit('selectProfile', p);
  emit('editProfile', p);
  emit('close');
}

async function handleExport(p: MappingProfile) {
  try {
    if (await profileService.exportProfile(p)) {
      showNotice(`Exported ${p.name}.dmap successfully!`);
    }
  } catch (err: any) {
    showError(err);
  }
}

async function handleDuplicate(id: string) {
  try {
    const cloned = await profileService.duplicateProfile(id);
    await refresh();
    emit('profilesUpdated');
    if (cloned) {
      showNotice(`Created copy: ${cloned.name}`);
    }
  } catch (err: any) {
    showError(err);
  }
}

async function handleDelete(id: string) {
  if (pendingDeleteId.value !== id) {
    pendingDeleteId.value = id;
    showNotice(t('profileModal.confirmDelete'));
    notificationIsError.value = true;
    setTimeout(() => {
      if (pendingDeleteId.value === id) pendingDeleteId.value = null;
    }, 3500);
    return;
  }
  pendingDeleteId.value = null;
  try {
    await profileService.deleteProfile(id);
    await refresh();
    emit('profilesUpdated');
    showNotice('Profile deleted.');
  } catch (err: any) {
    showError(err);
  }
}

function startRename(p: MappingProfile) {
  editingNameId.value = p.id;
  editedName.value = p.name;
}

async function saveRename(p: MappingProfile) {
  const name = editedName.value.trim();
  editingNameId.value = null;
  if (name && name !== p.name) {
    try {
      await profileService.saveProfile({ ...p, name });
      await refresh();
      emit('profilesUpdated');
    } catch (err: any) {
      showError(err);
    }
  }
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Cleared so choosing the same file again imports it again.
  input.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const imported = await profileService.importProfile(text);
    await refresh();
    emit('profilesUpdated');
    emit('selectProfile', imported);
    showNotice(`Imported profile "${imported.name}" ready for use!`);
  } catch (err: any) {
    showError({ message: `Failed to import .dmap file: ${err?.message || err}` });
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
        :class="notificationIsError
          ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'"
        class="border-b px-6 py-2 text-xs font-semibold flex items-center gap-1.5"
      >
        <AlertCircle v-if="notificationIsError" class="w-4 h-4" />
        <CheckCircle v-else class="w-4 h-4" />
        <span>{{ notification }}</span>
      </div>

      <!-- Action Bar -->
      <div class="px-6 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <span class="text-xs text-gray-500">
          {{ t(profileService.storageKind === 'database' ? 'profileModal.storedInDatabase' : 'profileModal.storedInBrowser', { count: profiles.length }) }}
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
            <!-- Edit Profile in Studio -->
            <button
              @click="handleEdit(p)"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-purple text-white hover:bg-brand-purple/90 transition-all shadow-sm"
              :title="t('profileModal.editProfile')"
            >
              <Pencil class="w-3.5 h-3.5" />
              <span>{{ t('profileModal.editProfile') }}</span>
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
              @click="handleDelete(p.id)"
              class="p-2 rounded-lg"
              :class="pendingDeleteId === p.id ? 'bg-red-500 text-white' : 'hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500'"
              :title="pendingDeleteId === p.id ? t('profileModal.confirmDelete') : t('profileModal.delete')"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Empty Profiles State -->
        <div v-if="profiles.length === 0" class="py-12 text-center space-y-2 text-gray-400">
          <FolderOpen class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
          <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('profileModal.noProfiles') }}</p>
          <p class="text-xs text-gray-400">{{ t('profileModal.noProfilesSubtitle') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
