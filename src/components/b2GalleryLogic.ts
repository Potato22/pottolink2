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

class ImageLoader {
    start: number;
    batchSize: number;
    loading: boolean;
    constructor(batchSize = 8) {
        this.start = 16;
        this.batchSize = batchSize;
        this.loading = false;
        this.setupInfiniteScroll();
    }

    setupInfiniteScroll(): void {
        const sentinel = document.createElement("div");
        sentinel.id = "scroll-sentinel";
        sentinel.style.height = "1px";
        const galleryGrid = document.getElementById("galleryGrid");
        if (galleryGrid) {
            galleryGrid.after(sentinel);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !this.loading) {
                        this.loadMoreImages();
                    }
                });
            },
            {
                rootMargin: "200px",
            }
        );

        observer.observe(sentinel);
    }

    async loadMoreImages(): Promise<void> {
        if (this.loading || this.start >= GalleryState.allDisplayImages.length) {
            return;
        }

        this.loading = true;
        const loadMoreButton = document.getElementById(
            "loadMore"
        ) as HTMLButtonElement | null;
        if (loadMoreButton) {
            loadMoreButton.textContent = "Pulling more shite";
        }

        const end = Math.min(
            this.start + this.batchSize,
            GalleryState.allDisplayImages.length
        );

        try {
            loadImages(this.start, end);
            this.start = end;

            if (end >= GalleryState.allDisplayImages.length) {
                this.disableLoader();
            }
        } finally {
            this.loading = false;
            if (loadMoreButton) {
                loadMoreButton.innerHTML =
                    "You reached the end..!<br><code>earliest index: 29 November 2020</code>";
                loadMoreButton.style.border = "none";
            }
        }
    }

    disableLoader(): void {
        const loadMoreButton = document.getElementById(
            "loadMore"
        ) as HTMLButtonElement | null;
        const titleElement = document.querySelector(
            ".wideGoTitle"
        ) as HTMLElement | null;
        const sentinel = document.getElementById("scroll-sentinel");

        if (titleElement) {
            titleElement.textContent = "Nothing left to load...";
        }

        if (loadMoreButton) {
            loadMoreButton.style.pointerEvents = "none";
            loadMoreButton.classList.add("fade-out");
        }

        if (sentinel) {
            sentinel.remove();
        }
    }
}

function loadImages(start: number, end: number): void {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                    observer.unobserve(img);
                }
            }
        });
    });

    const displayCount = GalleryState.allDisplayImages.slice(start, end);
    const latestWorkGrid = document.getElementById("galleryGrid");
    if (!latestWorkGrid) return;
    const imgDataFragment = document.createDocumentFragment();

    displayCount.forEach((item) => {
        const container = document.createElement("div");
        container.className = "image-container";

        const img = new Image();
        //img.setAttribute("data-aos", "zoom-in");
        img.className = "interactive imgs relative cards imgcard b2Imgs";
        //img.setAttribute("orbReact", "true");

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
        img.dataset.lossless = matchingLossless
            ? matchingLossless.urlLossless
            : "false";

        container.appendChild(img);
        imgDataFragment.appendChild(container);
        imageObserver.observe(img);
    });

    latestWorkGrid.appendChild(imgDataFragment);
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
        .map((entry) => entry.substr(1));

    GalleryState.flagsCache.set(input, flags);
    return flags;
}

function hasExtraFlags(imgsFilename: string): boolean {
    const flags = getFlags(imgsFilename);
    if (flags.length === 0) return false;
    if (flags.length === 1 && flags.includes("sfw")) return false;
    if (
        flags.includes("0") ||
        flags.includes("default") ||
        flags.includes("origin")
    )
        return false;
    return true;
}

// API fetching
async function fetchDisplay(): Promise<any[]> {
    const loadingIndicator = document.querySelector(
        ".galleryLoadingInd"
    ) as HTMLElement | null;

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

// Store the raw fetched data for reuse
let galleryRawData: any[] = [];

// Exportable reload helper for internal use (no args)
export function reloadGallery(): void {
    new ImageLoader(8)
    filterManager.refreshFilters(); // Ensure filters are up-to-date
    const galleryGrid = document.getElementById("galleryGrid");
    devConsole("Reloading gallery with raw data length:", galleryRawData.length);
    if (!galleryRawData.length) return;
    devConsole("Clearing gallery state and grid...");
    GalleryState.allDisplayImages.length = 0;
    GalleryState.losslessImages.length = 0;
    galleryGrid?.replaceChildren();
    // Optionally clear other caches if needed
    // GalleryState.flagsCache.clear();
    // GalleryState.imageMetadata = new WeakMap<object, any>();
    processImages(galleryRawData);
    loadImages(0, 16);
}

// Move processImages to top-level for reuse
export function processImages(data: any[]): void {
    data.forEach((item) => {
        if (
            item.contentType &&
            typeof item.contentType === "string" &&
            item.contentType.includes("image/")
        ) {
            if (item.name.includes("display/")) {
                const isSketch = item.url.includes("sketch");
                const isNSFW = item.url.includes("nsfw");
                const hasVersioning = hasExtraFlags(item.name);

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

    GalleryState.allDisplayImages.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

// Make filterManager accessible for reload
const filterManager = new FilterManager();

// Initialize the application
(function mainInit() {
    const imageLoader = new ImageLoader(8);
    async function initialize(): Promise<void> {
        const loadingIndicator = document.querySelector(
            ".galleryLoadingInd"
        ) as HTMLElement | null;
        try {
            const data = await fetchDisplay();
            if (!data) return;
            galleryRawData = data;
            reloadGallery();
            if (loadingIndicator) loadingIndicator.style.display = "none";
            const loadMoreButton = document.getElementById(
                "loadMore"
            ) as HTMLButtonElement | null;
            if (loadMoreButton) {
                loadMoreButton.style.display = "block";
            }
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

    // Start the application
    initialize();
    document.addEventListener("astro:after-swap", () => {
        initialize();
    });
})();