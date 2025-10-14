import { devConsole } from "./utils/devConsole";

interface DisplayImage {
    nameLossy: string;
    urlLossy: string;
    date: string;
    sketch: boolean | null;
    nsfw: boolean | null;
    versioning: boolean | null;
}

interface LosslessImage {
    nameLossless: string;
    urlLossless: string;
    date: string;
}

interface GalleryStateType {
    allDisplayImages: DisplayImage[];
    losslessImages: LosslessImage[];
    imageMetadata: WeakMap<object, any>;
    flagsCache: Map<string, string[]>;
}

const GalleryState: GalleryStateType = {
    allDisplayImages: [],
    losslessImages: [],
    imageMetadata: new WeakMap<object, any>(),
    flagsCache: new Map<string, string[]>(),
};

class FilterManager {
    filters: { nsfw: boolean; sketch: boolean; version: boolean };

    constructor() {
        this.filters = {
            nsfw: localStorage.getItem("filterNSFW") !== "displayed",
            sketch: localStorage.getItem("filterSketch") !== "displayed",
            version: localStorage.getItem("filterVersion") !== "displayed",
        };
    }

    refreshFilters(): void {
        this.filters.nsfw = localStorage.getItem("filterNSFW") !== "displayed";
        this.filters.sketch = localStorage.getItem("filterSketch") !== "displayed";
        this.filters.version = localStorage.getItem("filterVersion") !== "displayed";
    }

    applyFilters(images: DisplayImage[]): DisplayImage[] {
        return images.filter((item) => {
            return (
                (!this.filters.nsfw || !item.nsfw) &&
                (!this.filters.sketch || !item.sketch) &&
                (!this.filters.version || !item.versioning)
            );
        });
    }

    updateFilter(type: keyof typeof this.filters, value: boolean): void {
        this.filters[type] = value;
        localStorage.setItem(
            `filter${type.toUpperCase()}`,
            value ? "" : "displayed"
        );
    }
}

/**
 * I gave up bro
 * Manages the loading and rendering of images in batches for a gallery grid,
 * supporting infinite scroll and lazy loading via IntersectionObservers.
 *
 * - Handles initial and incremental image loading with customizable batch size.
 * - Observes a sentinel element to trigger loading more images as the user scrolls.
 * - Observes image elements for lazy loading, setting their `src` attribute when they enter the viewport.
 * - Updates UI elements such as "Load More" button and gallery title based on loading state.
 * - Cleans up observers and DOM elements when destroyed.
 *
 * @remarks
 * This class relies on the global `GalleryState` object for image data and expects
 * certain DOM elements (`galleryGrid`, `loadMore`, `.wideGoTitle`) to exist.
 *
 * @example
 * ```typescript
 * const loader = new ImageLoader(8);
 * loader.loadInitialImages();
 * // ...
 * loader.destroy();
 * ```
 */
class ImageLoader {
    /** The current index offset for loading images from the `allDisplayImages` array. */
    private currentIndex: number = 0;
    /** The number of images to load in each batch. */
    private readonly batchSize: number;
    /** A flag to prevent multiple simultaneous loading operations. */
    private loading: boolean = false;
    /** The IntersectionObserver for implementing infinite scrolling. */
    private intersectionObserver: IntersectionObserver | null = null;
    /** The IntersectionObserver for lazy loading individual images. */
    private lazyLoadObserver: IntersectionObserver | null = null;
    /** A placeholder element at the end of the gallery that triggers loading more images when it becomes visible. */
    private sentinel: HTMLElement | null = null;
    /** A flag to indicate whether the loader has been destroyed to prevent further operations. */
    private isDestroyed: boolean = false;

    /**
     * Initializes the ImageLoader with a specified batch size.
     * @param batchSize The number of images to load at a time. Defaults to 8.
     */
    constructor(batchSize = 8) {
        this.batchSize = batchSize;
        this.setupObservers();
    }

    /**
     * Sets up the IntersectionObservers for infinite scrolling and lazy loading images.
     */
    private setupObservers(): void {
        // Observer for infinite scroll: triggers loading more images when the sentinel comes into view.
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                if (this.isDestroyed) return;
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !this.loading) {
                        this.loadMoreImages();
                    }
                });
            },
            { rootMargin: "200px" } // Load content when the sentinel is 200px away from the viewport.
        );

        // Observer for lazy loading images: loads an image's `src` when it enters the viewport.
        this.lazyLoadObserver = new IntersectionObserver(
            (entries) => {
                if (this.isDestroyed) return;
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target as HTMLImageElement;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            delete img.dataset.src;
                            this.lazyLoadObserver!.unobserve(img);
                        }
                    }
                });
            },
            { rootMargin: "50px" } // Load image when it is 50px away from the viewport.
        );
    }

    /**
     * Creates and appends the sentinel element to the DOM, which is used to detect when to load more images.
     */
    private createSentinel(): void {
        this.sentinel = document.createElement("div");
        this.sentinel.id = "scroll-sentinel";
        this.sentinel.style.height = "1px";

        const galleryGrid = document.getElementById("galleryGrid");
        if (galleryGrid) {
            galleryGrid.after(this.sentinel);
            this.intersectionObserver?.observe(this.sentinel);
        }
    }

    /**
     * Resets the loader to its initial state, clearing the current position and recreating the sentinel.
     */
    reset(): void {
        this.currentIndex = 0;
        this.loading = false;
        this.removeSentinel();
        this.createSentinel();
    }

    /**
     * Removes the sentinel element from the DOM and stops observing it.
     */
    private removeSentinel(): void {
        if (this.sentinel) {
            this.intersectionObserver?.unobserve(this.sentinel);
            this.sentinel.remove();
            this.sentinel = null;
        }
    }

    /**
     * Loads the initial set of images into the gallery.
     */
    loadInitialImages(): void {
        const initialBatch = 16;
        this.renderImages(0, Math.min(initialBatch, GalleryState.allDisplayImages.length));
        this.currentIndex = Math.min(initialBatch, GalleryState.allDisplayImages.length);

        if (this.currentIndex < GalleryState.allDisplayImages.length) {
            this.createSentinel();
        } else {
            this.disableLoader();
        }
    }

    /**
     * Asynchronously loads the next batch of images.
     */
    private async loadMoreImages(): Promise<void> {
        if (this.loading || this.currentIndex >= GalleryState.allDisplayImages.length || this.isDestroyed) {
            return;
        }

        this.loading = true;
        this.updateLoadMoreButton("Pulling more shite");

        const endIndex = Math.min(
            this.currentIndex + this.batchSize,
            GalleryState.allDisplayImages.length
        );

        try {
            this.renderImages(this.currentIndex, endIndex);
            this.currentIndex = endIndex;

            if (this.currentIndex >= GalleryState.allDisplayImages.length) {
                this.disableLoader();
            }
        } finally {
            this.loading = false;
        }
    }

    /**
     * Renders a slice of images into the gallery grid.
     * @param start The starting index of the images to render.
     * @param end The ending index of the images to render.
     */
    private renderImages(start: number, end: number): void {
        if (this.isDestroyed) return;

        const galleryGrid = document.getElementById("galleryGrid");
        if (!galleryGrid) return;

        const fragment = document.createDocumentFragment();
        const imagesToRender = GalleryState.allDisplayImages.slice(start, end);

        imagesToRender.forEach((item) => {
            const container = this.createImageContainer(item);
            fragment.appendChild(container);
        });

        galleryGrid.appendChild(fragment);
    }

    /**
     * Creates an image container with a lazy-loadable image element.
     * @param item The image data to create the container for.
     * @returns The created HTMLElement.
     */
    private createImageContainer(item: DisplayImage): HTMLElement {
        const container = document.createElement("div");
        container.className = "image-container";

        const img = new Image();
        img.className = "interactive imgs relative cards imgcard b2Imgs";
        img.dataset.src = item.urlLossy;
        img.alt = item.nameLossy;
        img.dataset.title = item.nameLossy;
        img.setAttribute("aria-label", item.nameLossy);

        Object.assign(img.dataset, {
            nsfw: item.nsfw ? "true" : "false",
            sketch: item.sketch ? "true" : "false",
            versioning: item.versioning ? "true" : "false",
        });

        const matchingLossless = GalleryState.losslessImages.find(
            (x) => x.nameLossless === item.nameLossy
        );
        img.dataset.lossless = matchingLossless ? matchingLossless.urlLossless : "false";

        container.appendChild(img);
        this.lazyLoadObserver?.observe(img);

        return container;
    }

    /**
     * Updates the text content of the "Load More" button.
     * @param text The text to display on the button.
     */
    private updateLoadMoreButton(text: string): void {
        const loadMoreButton = document.getElementById("loadMore") as HTMLButtonElement | null;
        if (loadMoreButton) {
            loadMoreButton.textContent = text;
        }
    }

    /**
     * Disables the loader when all images have been loaded, updating UI elements to reflect this state.
     */
    private disableLoader(): void {
        const loadMoreButton = document.getElementById("loadMore") as HTMLButtonElement | null;
        const titleElement = document.querySelector(".wideGoTitle") as HTMLElement | null;

        if (titleElement) {
            titleElement.textContent = "Nothing left to load...";
        }

        if (loadMoreButton) {
            loadMoreButton.innerHTML = "You've reached the end..!<br><code>earliest index: 29 November 2020</code>";
            loadMoreButton.style.border = "none";
            loadMoreButton.style.pointerEvents = "none";
            loadMoreButton.classList.add("fade-out");
        }

        this.removeSentinel();
    }

    /**
     * Cleans up resources used by the ImageLoader, such as observers and DOM elements.
     */
    destroy(): void {
        this.isDestroyed = true;
        this.intersectionObserver?.disconnect();
        this.lazyLoadObserver?.disconnect();
        this.removeSentinel();
        this.intersectionObserver = null;
        this.lazyLoadObserver = null;
    }
}

// Helper functions
function getFlags(input: string): string[] {
    if (GalleryState.flagsCache.has(input)) {
        return GalleryState.flagsCache.get(input)!;
    }

    const flags = input
        .split(".")
        .join(" ")
        .split(" ")
        .filter((entry) => entry.startsWith("-"))
        .map((entry) => entry.substring(1));

    GalleryState.flagsCache.set(input, flags);
    return flags;
}

function hasExtraFlags(imgsFilename: string): boolean {
    const flags = getFlags(imgsFilename);
    if (flags.length === 0) return false;
    if (flags.length === 1 && flags.includes("sfw")) return false;
    if (flags.includes("0") || flags.includes("default") || flags.includes("origin")) return false;
    return true;
}

// API fetching
async function fetchDisplay(): Promise<any[]> {
    const loadingIndicator = document.querySelector(".galleryLoadingInd") as HTMLElement | null;

    try {
        if (loadingIndicator) {
            loadingIndicator.textContent = "Hold on...";
            loadingIndicator.classList.add("holdon");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
            "https://pottob2-dispgallery.pottoart.workers.dev/api/v1/list_all_files?maxFileCount=800",
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        const errorMessage =
            error.name === "AbortError"
                ? `Request timed out. You could probably try refreshing but it's a lot more likely something went horribly wrong in the backend.`
                : `Error: ${error.message}`;

        if (loadingIndicator) {
            loadingIndicator.textContent = errorMessage;
            loadingIndicator.classList.remove("holdon");
        }
        throw error;
    }
}

function processImages(data: any[], filterManager: FilterManager): void {
    // Clear existing state
    GalleryState.allDisplayImages.length = 0;
    GalleryState.losslessImages.length = 0;

    data.forEach((item) => {
        if (item.contentType?.includes?.("image/")) {
            if (item.name.includes("display/")) {
                const isSketch = item.url.includes("sketch");
                const isNSFW = item.url.includes("nsfw");
                const hasVersioning = hasExtraFlags(item.name);

                // Apply filters during processing
                if (
                    (!filterManager.filters.nsfw || !isNSFW) &&
                    (!filterManager.filters.version || !hasVersioning) &&
                    (!filterManager.filters.sketch || !isSketch)
                ) {
                    GalleryState.allDisplayImages.push({
                        nameLossy: item.name
                            .replace(/(?:display|lossless)\//, "")
                            .replace("nsfw/", "")
                            .replace("sketch/", "")
                            .split(".")[0],
                        urlLossy: item.url,
                        date: item.uploadTime,
                        sketch: isSketch || null,
                        nsfw: isNSFW || null,
                        versioning: hasVersioning || null,
                    });
                }
            } else if (item.name.includes("lossless/")) {
                GalleryState.losslessImages.push({
                    nameLossless: item.name
                        .replace(/(?:display|lossless)\//, "")
                        .replace("nsfw/", "")
                        .split(".")[0],
                    urlLossless: item.url,
                    date: item.uploadTime,
                });
            }
        }
    });

    // Sort by date (newest first)
    GalleryState.allDisplayImages.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

// Gallery Manager - Single source of truth
class GalleryManager {
    private filterManager: FilterManager;
    private imageLoader: ImageLoader | null = null;
    private rawData: any[] = [];

    constructor() {
        this.filterManager = new FilterManager();
    }

    async initialize(): Promise<void> {
        const loadingIndicator = document.querySelector(".galleryLoadingInd") as HTMLElement | null;

        try {
            const data = await fetchDisplay();
            if (!data) return;

            this.rawData = data;
            this.reload();

            if (loadingIndicator) loadingIndicator.style.display = "none";
            const loadMoreButton = document.getElementById("loadMore") as HTMLButtonElement | null;
            if (loadMoreButton) loadMoreButton.style.display = "block";

        } catch (error) {
            console.error("Initialization failed:", error);
            if (loadingIndicator) {
                loadingIndicator.innerHTML = `
                    <b>Failed to load images.</b> Which can only mean that something is broken beyond human comprehension.<br>
                    Notify Potto or something, they're not human. Probably.<br><br>
                    Tell them: <b>./gallery: ${error instanceof Error ? error.message : "Unknown error, you're cooked."}</b>
                `;
                loadingIndicator.classList.remove("holdon");
            }
        }
    }

    reload(): void {
        devConsole("Reloading gallery with raw data length:", this.rawData.length);

        if (!this.rawData.length) return;

        // Clean up existing loader
        if (this.imageLoader) {
            this.imageLoader.destroy();
        }

        // Clear gallery grid
        const galleryGrid = document.getElementById("galleryGrid");
        galleryGrid?.replaceChildren();

        // Refresh filters and process images
        this.filterManager.refreshFilters();
        processImages(this.rawData, this.filterManager);

        // Create new loader and load initial images
        this.imageLoader = new ImageLoader(8);
        this.imageLoader.loadInitialImages();
    }

    getFilterManager(): FilterManager {
        return this.filterManager;
    }
}

// Global gallery manager instance
const galleryManager = new GalleryManager();

// Export functions
export function reloadGallery(): void {
    galleryManager.reload();
}

export function getFilterManager(): FilterManager {
    return galleryManager.getFilterManager();
}

// Initialize the application
(function mainInit() {
    async function initialize(): Promise<void> {
        await galleryManager.initialize();
    }

    // Start the application
    initialize();
    document.addEventListener("astro:after-swap", initialize);
})();