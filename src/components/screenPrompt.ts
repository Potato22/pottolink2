import { navigate } from "astro:transitions/client";
const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

function wipeListeners(el: HTMLElement): HTMLElement {
    const clone = el.cloneNode(true) as HTMLElement;
    el.replaceWith(clone);
    return clone;
}

let floatTarget: string;
export async function promptStoreTarget(target: string | null | undefined, command?: "go") {
    if (target) {
        floatTarget = target;
    }
    if (command === "go") {
        screenPrompt("close")
        await sleep(400)
        navigate(floatTarget);
    }
}

export async function screenPrompt(mode: string) {
    const screen = document.getElementById("bigScreen") as HTMLElement;
    const screenButtons = document.getElementById(
        "screenButtons"
    ) as HTMLElement;
    const screenHeading = document.getElementById(
        "screenHeading"
    ) as HTMLElement;

    const sBtn = document.querySelectorAll(".sBtn") as NodeListOf<HTMLElement>

    async function goRead() {
        screenPrompt("close")
        await sleep(300)
        navigate("/tos")
    }

    switch (mode) {
        case "initialize":
            screenPrompt("reset");
            screen.style.display = "flex";
            await sleep(10);

            screen.classList.add("active");
            break;
        case "close":
            screenButtons.style.opacity = "0";
            screenButtons.style.transform = "translateY(2em)";
            await sleep(100);
            screen.classList.remove("active");
            await sleep(300);
            screen.style.display = "none";
            break;
        case "reset":
            screenButtons.style.transform = "";
            screenButtons.style.pointerEvents = "none";
            sBtn.forEach((btns) => {
                wipeListeners(btns);
                btns.innerHTML = "";
                btns.dataset.highlight = "";
            })
            break;
        case "noTos":
            screenPrompt("initialize");

            await sleep(400)

            const b0 = document.getElementById("screen-button0") as HTMLElement;
            const b1 = document.getElementById("screen-button1") as HTMLElement;
            const b2 = document.getElementById("screen-button2") as HTMLElement;

            screenHeading.innerHTML = "Welcome! I'd advise you to read the TOS first.";
            screenHeading.style.opacity = "1";
            screenButtons.style.opacity = "1";
            screenButtons.style.pointerEvents = "all";
            b0.innerHTML = "Close";
            b1.innerHTML = "Only checking in";
            b2.innerHTML = "OK";
            b2.dataset.highlight = "true";
            b0.addEventListener("click", () => screenPrompt("close"));
            b1.addEventListener("click", () => promptStoreTarget(null, "go"));
            b2.addEventListener("click", goRead);
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    screenPrompt("close");
                }
            });
            break;
        default:
            break;
    }
}