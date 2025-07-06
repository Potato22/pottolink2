declare global {
  interface Window {
    quirkyLoader: {
      lock: () => void;
      unlock: () => void;
    };
  }
}
export {};