import type { HTMLAttributes } from 'astro/types';

declare global {
  interface Window {
    quirkyLoader: {
      lock: () => void;
      unlock: () => void;
    };
  }
}

declare module 'astro/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      video: JSX.IntrinsicElements['video'] & { alt?: string };
    }
  }
}


export { };