// tailwind.config.js
export const theme = {
    extend: {
        transitionTimingFunction: {
            'sleek': 'var(--sleek)',
        },
        FontFace: {
            'font-display': 'var(--display)',
            'font-content': 'var(--content)',
            'font-contentsecondary': 'var(--contentsecondary)',
        },
        colors: {
            'accent-d': 'var(--accentD)',
            'base-secondary-d': 'var(--basesecondaryD)',
            'text-d': 'var(--textD)',
            // ... other custom colors
            // suppedly anyway
        },
    },
};