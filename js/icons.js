// ============================================================================
// ICONS - inline line icons that take the colour of their text
// ============================================================================

const PATHS = {
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 1.5 1.5 2.5 2.5 2.5 0-3-1-5.5 0-7.5z"></path>',
    book: '<path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM4 19a2 2 0 0 1 2-2h12"></path>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-1 9.5z"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path>',
    chevronRight: '<path d="m9 6 6 6-6 6"></path>',
    chevronLeft: '<path d="m15 6-6 6 6 6"></path>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"></path>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"></path>',
    undo: '<path d="M9 14 4 9l5-5"></path><path d="M4 9h10a6 6 0 0 1 0 12h-3"></path>',
    file: '<path d="M7 3h7l5 5v13H7z"></path><path d="M14 3v5h5M10 13h6M10 17h6"></path>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
    words: '<path d="M4 6h16M4 12h16M4 18h10"></path>',
    add: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path>',
    progress: '<path d="M5 20v-7M12 20V5M19 20v-11"></path>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
    speaker: '<path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="m13.5 6.5 4 4"></path>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"></path>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle>'
};

function icon(name, size = 20) {
    return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
}

module.exports = { icon };
