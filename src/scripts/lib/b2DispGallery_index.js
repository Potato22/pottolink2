(() => {
    console.log('init');

    let filterNSFW = true;
    let filterVersion = false;
    let filterSketch = true;

    async function fetchDisplay() {
        console.log('async fetchDisplay');
        try {
            $(".galleryLoadingInd").html('Hold on...').addClass('holdon');
            console.log('attempting to call');
            const response = await fetch('https://pottob2-dispgallery.pottoart.workers.dev/api/v1/list_all_files?maxFileCount=8');
            if (!response.ok) {
                $(".galleryLoadingInd").html("Bucket responded with " + response.status).removeClass('holdon');
                throw new Error('Something went wrong while trying to fetch files', response.status);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            $(".galleryLoadingInd").html("Something went horribly wrong: list_all_files: " + error.message).removeClass('holdon');
            console.error('*blows up json with mind*', error.message);
            return null;
        }
    }

    fetchDisplay()
        .then(data => {
            if (data) {
                console.log('Fetched files:', data);
                console.log("filtering");
                // Data processing
                const displayImages = [];
                const losslessImages = [];

                data.forEach(item => {
                    if (item.contentType.includes('image/')) {
                        if (item.name.includes('display/')) {
                            const nameVariable = 'nameLossy';
                            const urlDisplay = 'urlLossy';
                            const dateUploaded = 'date';
                            const isSketch = item.url.includes('sketch');
                            const isNSFW = item.url.includes('nsfw');
                            const hasVersioning = hasExtraFlags(item.name);

                            // Apply filters
                            if ((!filterNSFW || !isNSFW) && (!filterVersion || !hasVersioning) && (!filterSketch || !isSketch)) {
                                displayImages.push({
                                    [nameVariable]: item.name.replace(/(?:display|lossless)\//, '').replace('nsfw/', '').replace('sketch/', '').split('.')[0],
                                    [urlDisplay]: item.url,
                                    [dateUploaded]: item.uploadTime,
                                    sketch: isSketch ? true : null,
                                    nsfw: isNSFW ? true : null,
                                    versioning: hasVersioning ? true : null,
                                });
                            }
                        } else if (item.name.includes('lossless/')) {
                            const nameVariable = 'nameLossless';
                            losslessImages.push({
                                [nameVariable]: item.name.replace(/(?:display|lossless)\//, '').replace('nsfw/', '').split('.')[0],
                                urlLossless: item.url,
                                date: item.uploadTime
                            });
                        }
                    }
                });

                displayImages.sort((a, b) => new Date(b.date) - new Date(a.date));
                const displayCount = displayImages.slice(0, 8);

                console.log("Display Data:", displayCount);
                console.log("Lossless Data:", losslessImages);

                const latestWorkGrid = document.getElementById('latestWorks');
                const imgDataFragment = document.createDocumentFragment();

                displayCount.forEach(item => {
                    const img = new Image();
                    const losslessLinko = document.createElement('p');
                    img.setAttribute('data-aos', 'zoom-in');
                    img.setAttribute('class', 'imgs self cards imgcard b2Imgs');
                    img.setAttribute('orbReact', 'true');
                    //img.setAttribute('loading', 'lazy');
                    img.src = item.urlLossy;
                    img.alt = item.nameLossy; // remove file ext
                    img.dataset.nsfw = item.nsfw ? 'true' : 'false';
                    img.dataset.sketch = item.sketch ? 'true' : 'false';
                    img.dataset.versioning = item.versioning ? 'true' : 'false';

                    const matchingLossless = losslessImages.find(x => x.nameLossless === item.nameLossy);
                    if (matchingLossless) {
                        losslessLinko.textContent = 'lossless: ' + matchingLossless.urlLossless;
                        img.dataset.lossless = matchingLossless.urlLossless;
                    } else if (item.sketch) {
                        losslessLinko.textContent = 'Sketch: ' + item.urlLossy;
                    } else {
                        losslessLinko.textContent = 'No lossless version available';
                        img.dataset.lossless = false;
                    }

                    imgDataFragment.append(img);
                });

                latestWorkGrid.replaceChildren(imgDataFragment);
                $(".galleryLoadingInd").fadeOut();
            }
        })
        .catch(error => {
            console.error('Error during fetch:', error);
            $(".galleryLoadingInd").html("Fetching was successful but something still went wrong, not good news tell you that now. "+ error).removeClass('holdon');
        });

    // GET FLAGS
    function getFlags(input) {
        let ret = [];
        let entries = input.split(".").join(" ").split(" ");
        entries.forEach(entry => {
            if (entry.startsWith("-")) {
                ret.push(entry.substr(1));
            }
        });
        return ret;
    }

    // DETECT "FLAGS"
    function hasExtraFlags(imgsFilename) {
        const flags = getFlags(imgsFilename);
        if (flags.length === 0) return false;
        if (flags.length === 1 && flags.includes("sfw")) return false;
        if (flags.includes("0" || "default")) return false;
        return true;
    }
})();