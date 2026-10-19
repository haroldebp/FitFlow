import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Recipe photos live in their own small store so the main store (recipes,
 * plans, settings) stays fast to save. Recipes point here with "img:<id>".
 */
type ImageState = {
  images: Record<string, string>; // id -> data URI
  put: (dataUri: string) => string; // returns "img:<id>"
  remove: (ref?: string) => void;
};

export const useImages = create<ImageState>()(
  persist(
    (set) => ({
      images: {},
      put: (dataUri) => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        set((s) => ({ images: { ...s.images, [id]: dataUri } }));
        return `img:${id}`;
      },
      remove: (ref) => {
        if (!ref?.startsWith('img:')) return;
        const id = ref.slice(4);
        set((s) => {
          const images = { ...s.images };
          delete images[id];
          return { images };
        });
      },
    }),
    { name: 'fitflow-images', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Turns a stored image reference into something <Image> can show. */
export const useImageUri = (ref?: string) =>
  useImages((s) => (ref?.startsWith('img:') ? s.images[ref.slice(4)] : ref));

/** Data URIs go into the image store; normal URLs are kept as-is. */
export const storeImage = (uri?: string | null) => {
  if (!uri) return undefined;
  return uri.startsWith('data:') ? useImages.getState().put(uri) : uri;
};
