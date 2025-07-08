import { reloadGallery } from "./b2GalleryLogic";
let isGalleryPage = false;

function filterLogic() {
    const nsfwSwitch = document.getElementById("nsfwFTT") as HTMLInputElement | null;
    const sketchSwitch = document.getElementById("sketchFTT") as HTMLInputElement | null;
    const versioningSwitch = document.getElementById("versioningFTT") as HTMLInputElement | null;

    const dataNSFW: string | null = localStorage.getItem("filterNSFW");
    const dataSketch: string | null = localStorage.getItem("filterSketch");
    const dataVersion: string | null = localStorage.getItem("filterVersion");

    //function checkGlobal() {
    //    console.log('-----------------------------------')
    //    console.log('dataNSFW display:', dataNSFW)
    //    console.log('dataSketch display:', dataSketch)
    //    console.log('dataVersion display:', dataVersion)
    //    console.log('-----------------------------------')
    //}

    const fO_NSFW = document.querySelector(".ftObj_NSFW") as HTMLElement | null;
    const fO_Sketch = document.querySelector(".ftObj_Sketch") as HTMLElement | null;
    const fO_Versioning = document.querySelector(".ftObj_Versioning") as HTMLElement | null;

    function switchUpdate(this: HTMLInputElement, switchChange: Event) {
        // const reloadButton = document.getElementById("reloadButton");
        // if (reloadButton) reloadButton.classList.add("reloadReady");
        let whichSwitch = this.id;
        const target = switchChange.target as HTMLInputElement;
        if (target.checked) {
            switch (whichSwitch) {
                case "nsfwFTT":
                    localStorage.setItem("filterNSFW", "displayed");
                    fO_NSFW?.classList.add('FTon');
                    break;
                case "sketchFTT":
                    localStorage.setItem("filterSketch", "displayed");
                    fO_Sketch?.classList.add('FTon');
                    break;
                case "versioningFTT":
                    localStorage.setItem("filterVersion", "displayed");
                    fO_Versioning?.classList.add('FTon');
                    break;
                default:
                    break;
            }
        } else {
            switch (whichSwitch) {
                case "nsfwFTT":
                    localStorage.setItem("filterNSFW", "hidden");
                    fO_NSFW?.classList.remove('FTon');
                    break;
                case "sketchFTT":
                    localStorage.setItem("filterSketch", "hidden");
                    fO_Sketch?.classList.remove('FTon');
                    break;
                case "versioningFTT":
                    localStorage.setItem("filterVersion", "hidden");
                    fO_Versioning?.classList.remove('FTon');
                    break;
                default:
                    break;
            }
        }
        console.log("which: ", whichSwitch, "(displayed:", target.checked, ")")
        //checkGlobal()

        invokeReload();
    }

    function setDefaultFallback(): void {
        fO_NSFW?.classList.remove('FTon');
        if (nsfwSwitch) nsfwSwitch.checked = false;
        localStorage.setItem("filterNSFW", "hidden");

        fO_Sketch?.classList.add('FTon');
        if (sketchSwitch) sketchSwitch.checked = true;
        localStorage.setItem("filterSketch", "displayed");

        fO_Versioning?.classList.add('FTon');
        if (versioningSwitch) versioningSwitch.checked = true;
        localStorage.setItem("filterVersion", "displayed");
    }

    if (dataNSFW === null || dataSketch === null || dataVersion === null) {
        setDefaultFallback();
    } else {
        //checkGlobal();
        if ([dataNSFW, dataSketch, dataVersion].every(variable => variable === "hidden")) {
            setDefaultFallback();
        } else {
            if (dataNSFW === "displayed") {
                if (nsfwSwitch) nsfwSwitch.checked = true;
                fO_NSFW?.classList.add('FTon');
            } else {
                if (nsfwSwitch) nsfwSwitch.checked = false;
                fO_NSFW?.classList.remove('FTon');
            }
            if (dataSketch === "displayed") {
                if (sketchSwitch) sketchSwitch.checked = true;
                fO_Sketch?.classList.add('FTon');
            } else {
                if (sketchSwitch) sketchSwitch.checked = false;
                fO_Sketch?.classList.remove('FTon');
            }
            if (dataVersion === "displayed") {
                if (versioningSwitch) versioningSwitch.checked = true;
                fO_Versioning?.classList.add('FTon');
            } else {
                if (versioningSwitch) versioningSwitch.checked = false;
                fO_Versioning?.classList.remove('FTon');
            }
        }
    }

    const refreshIndicator = document.querySelector(".refreshIndicator") as HTMLElement | null;
    const progBar = document.querySelector(".progBar") as HTMLElement | null;
    let timer: number;
    function invokeReload() {
        refreshIndicator?.style.setProperty("display", "flex");
        progBar?.classList.remove("start");
        window.scrollTo(0, 0)
        setTimeout(() => {
            progBar?.classList.add("start");
            refreshIndicator?.classList.add("show");
        }, 1);
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            reloadGallery();
            refreshIndicator?.classList.remove("show");
            setTimeout(() => {
                refreshIndicator?.style.setProperty("display", "none");
            }, 200);
        }, 1500);
    }

    // Checkbox listeners
    const filterSwitches = document.querySelectorAll<HTMLInputElement>('.filterToggleObject input[type="checkbox"]');
    filterSwitches.forEach((switches) => {
        switches.addEventListener("change", switchUpdate, false);
    });
}

function initSetup() {
    const currentPath = window.location.pathname;
    if (!(currentPath.includes("gallery"))) return
    filterLogic();
}

document.addEventListener("astro:after-swap", initSetup);
document.addEventListener("DOMContentLoaded", initSetup);