// Create a namespace for shared state
const GalleryState = {
    allDisplayImages: [],
    losslessImages: [],
    imageMetadata: new WeakMap(),
    flagsCache: new Map()
};

class FilterManager {
    constructor() {
        this.filters = {
            nsfw: localStorage.getItem("filterNSFW") !== "displayed",
            sketch: localStorage.getItem("filterSketch") !== "displayed",
            version: localStorage.getItem("filterVersion") !== "displayed"
        };
    }

    applyFilters(images) {
        return images.filter(item => {
            return (!this.filters.nsfw || !item.nsfw) &&
                (!this.filters.sketch || !item.sketch) &&
                (!this.filters.version || !item.versioning);
        });
    }

    updateFilter(type, value) {
        this.filters[type] = value;
        localStorage.setItem(`filter${type.toUpperCase()}`, value ? "" : "displayed");
    }
}

class ImageLoader {
    constructor(batchSize = 8) {
        this.start = 16;
        this.batchSize = batchSize;
        this.loading = false;
        this.setupInfiniteScroll();
    }

    setupInfiniteScroll() {
        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '1px';
        document.getElementById('latestWorks').after(sentinel);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.loading) {
                    this.loadMoreImages();
                }
            });
        }, {
            rootMargin: '200px'
        });

        observer.observe(sentinel);
    }

    async loadMoreImages() {
        if (this.loading || this.start >= GalleryState.allDisplayImages.length) {
            return;
        }

        this.loading = true;
        const loadMoreButton = document.getElementById('loadMore');
        if (loadMoreButton) {
            loadMoreButton.textContent = 'Pulling more shite';
        }

        const end = Math.min(this.start + this.batchSize, GalleryState.allDisplayImages.length);

        try {
            loadImages(this.start, end);
            this.start = end;

            if (end >= GalleryState.allDisplayImages.length) {
                this.disableLoader();
            }
        } finally {
            this.loading = false;
            if (loadMoreButton) {
                loadMoreButton.innerHTML = 'You reached the end..!<br><code>earliest index: 29 November 2020</code>';
                loadMoreButton.style.border = 'none';
            }
        }
    }

    disableLoader() {
        const loadMoreButton = document.getElementById('loadMore');
        const titleElement = document.querySelector(".wideGoTitle");
        const sentinel = document.getElementById('scroll-sentinel');

        if (titleElement) {
            titleElement.textContent = "Nothing left to load...";
        }

        if (loadMoreButton) {
            loadMoreButton.style.pointerEvents = 'none';
            loadMoreButton.classList.add('fade-out');
        }

        if (sentinel) {
            sentinel.remove();
        }
    }
}

function loadImages(start, end) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                    observer.unobserve(img);
                }
            }
        });
    });

    const displayCount = GalleryState.allDisplayImages.slice(start, end);
    const latestWorkGrid = document.getElementById('latestWorks');
    const imgDataFragment = document.createDocumentFragment();

    displayCount.forEach(item => {
        const container = document.createElement('div');
        container.className = 'image-container';

        const img = new Image();
        img.setAttribute('data-aos', 'zoom-in');
        img.className = 'imgs self cards b2Imgs';
        img.setAttribute('orbReact', 'true');

        img.dataset.src = item.urlLossy;
        img.alt = item.nameLossy;
        img.setAttribute('aria-label', item.nameLossy);

        Object.assign(img.dataset, {
            nsfw: item.nsfw ? 'true' : 'false',
            sketch: item.sketch ? 'true' : 'false',
            versioning: item.versioning ? 'true' : 'false'
        });

        const matchingLossless = GalleryState.losslessImages.find(x => x.nameLossless === item.nameLossy);
        img.dataset.lossless = matchingLossless ? matchingLossless.urlLossless : 'false';

        container.appendChild(img);
        imgDataFragment.appendChild(container);
        imageObserver.observe(img);
    });

    latestWorkGrid.appendChild(imgDataFragment);
}

// Helper functions
function getFlags(input) {
    if (GalleryState.flagsCache.has(input)) {
        return GalleryState.flagsCache.get(input);
    }

    const flags = input.split(".")
        .join(" ")
        .split(" ")
        .filter(entry => entry.startsWith("-"))
        .map(entry => entry.substr(1));

    GalleryState.flagsCache.set(input, flags);
    return flags;
}

function hasExtraFlags(imgsFilename) {
    const flags = getFlags(imgsFilename);
    if (flags.length === 0) return false;
    if (flags.length === 1 && flags.includes("sfw")) return false;
    if (flags.includes("0") || flags.includes("default") || flags.includes("origin")) return false;
    return true;
}

// API fetching
async function fetchDisplay() {
    const loadingIndicator = document.querySelector(".galleryLoadingInd");

    try {
        loadingIndicator.textContent = 'Hold on...';
        loadingIndicator.classList.add('holdon');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
            'https://pottob2-dispgallery.pottoart.workers.dev/api/v1/list_all_files?maxFileCount=800',
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        const errorMessage = error.name === 'AbortError'
            ? 'Request timed out. Please try again.'
            : `Error: ${error.message}`;

        loadingIndicator.textContent = errorMessage;
        loadingIndicator.classList.remove('holdon');
        throw error;
    }
}

// Initialize the application
(() => {
    const filterManager = new FilterManager();
    const imageLoader = new ImageLoader(8);

    function processImages(data) {
        data.forEach(item => {
            if (item.contentType.includes('image/')) {
                if (item.name.includes('display/')) {
                    const isSketch = item.url.includes('sketch');
                    const isNSFW = item.url.includes('nsfw');
                    const hasVersioning = hasExtraFlags(item.name);

                    if ((!filterManager.filters.nsfw || !isNSFW) &&
                        (!filterManager.filters.version || !hasVersioning) &&
                        (!filterManager.filters.sketch || !isSketch)) {
                        GalleryState.allDisplayImages.push({
                            nameLossy: item.name.replace(/(?:display|lossless)\//, '').replace('nsfw/', '').replace('sketch/', '').split('.')[0],
                            urlLossy: item.url,
                            date: item.uploadTime,
                            sketch: isSketch || null,
                            nsfw: isNSFW || null,
                            versioning: hasVersioning || null,
                        });
                    }
                } else if (item.name.includes('lossless/')) {
                    GalleryState.losslessImages.push({
                        nameLossless: item.name.replace(/(?:display|lossless)\//, '').replace('nsfw/', '').split('.')[0],
                        urlLossless: item.url,
                        date: item.uploadTime
                    });
                }
            }
        });

        GalleryState.allDisplayImages.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async function initialize() {
        const loadingIndicator = document.querySelector(".galleryLoadingInd");
        try {
            const data = await fetchDisplay();
            if (!data) return;

            processImages(data);
            loadImages(0, 16);

            loadingIndicator.style.display = 'none';
            const loadMoreButton = document.getElementById('loadMore');
            if (loadMoreButton) {
                loadMoreButton.style.display = 'block';
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            if (loadingIndicator) {
                loadingIndicator.textContent = 'Failed to load images. Please try again.';
                loadingIndicator.classList.remove('holdon');
            }
        }
    }

    // Start the application
    initialize();
})();