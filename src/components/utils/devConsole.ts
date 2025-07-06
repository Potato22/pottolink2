export function devConsole(...args: any[]): void {
    if (import.meta.env.DEV) {
        console.log(...args);
    }
}