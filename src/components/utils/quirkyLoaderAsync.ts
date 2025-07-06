export async function withLoaderAnim<T>(promise: Promise<T>) {
  const loaderAnim = document.getElementById("quirkyContainer") as HTMLElement;
  if (loaderAnim) {
    setTimeout(() => {
      loaderAnim.style.display = "flex";
    }, 10);
    loaderAnim.classList.add("loading");
  }
  try {
    return await promise;
  } finally {
    if (loaderAnim) {
      loaderAnim.classList.remove("loading");
      setTimeout(() => {
        loaderAnim.style.display = "";
      }, 300);
    }
  }
}