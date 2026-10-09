import { ref, readonly } from 'vue';

export type AppRoute = 'processor' | 'mapping';

const currentRoute = ref<AppRoute>('processor');

function parseHash(): AppRoute {
  const hash = window.location.hash.toLowerCase();
  if (hash.startsWith('#/mapping')) {
    return 'mapping';
  }
  return 'processor';
}

function syncRoute() {
  currentRoute.value = parseHash();
}

// Initial sync if in browser
if (typeof window !== 'undefined') {
  currentRoute.value = parseHash();
  window.addEventListener('hashchange', syncRoute);
}

export function useRouter() {
  const navigate = (to: AppRoute) => {
    if (typeof window !== 'undefined') {
      window.location.hash = to === 'mapping' ? '#/mapping' : '#/';
      currentRoute.value = to;
    }
  };

  return {
    currentRoute: readonly(currentRoute),
    navigate,
  };
}
