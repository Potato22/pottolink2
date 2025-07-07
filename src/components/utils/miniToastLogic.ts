export function pushToast(string?: string, duration: number = 3000) {
    const toastBox = document.querySelector(".mtBox") as HTMLElement;
    const toastObj = document.querySelector(".mtObj") as HTMLElement;

    if (!string) {
        return;
    }

    setTimeout(() => {
        toastObj.innerHTML = string;
        toastObj.classList.add("show");
    }, 5);

    setTimeout(() => {
        toastObj.classList.remove("show");
    }, duration);
}

document.addEventListener("DOMContentLoaded", () => {
    pushToast();
});
document.addEventListener("astro:after-swap", () => {
    pushToast();
});