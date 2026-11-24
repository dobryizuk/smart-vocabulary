// ============================================================================
// SETTINGS VIEW - markup of the Settings screen inside the Stats tab
// ============================================================================

const { icon } = require('./icons.js');
const { MIN_SESSION_SIZE, MAX_SESSION_SIZE } = require('./session-settings.js');
const { getVersionLabel } = require('./app-version.js');

const THEMES = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'System' }
];

function sectionHtml(title, body) {
    return `<h2 class="settings-section__title">${title}</h2>${body}`;
}

function switchRowHtml({ label, id, testId, action }) {
    const actionAttr = action ? ` data-action="${action}"` : '';
    return `
        <li class="settings-row">
            <span class="settings-row__label" id="${id}Label">${label}</span>
            <button type="button" class="switch" role="switch" aria-checked="false" aria-labelledby="${id}Label" id="${id}"${actionAttr} data-testid="${testId}"><span class="switch__knob"></span></button>
        </li>
    `;
}

function actionRowHtml({ label, iconName, action, testId }) {
    const actionAttr = action ? ` data-action="${action}"` : '';
    return `
        <li><button type="button" class="settings-action"${actionAttr} data-testid="${testId}">${icon(iconName)}${label}</button></li>
    `;
}

function learningHtml(sessionSize) {
    return sectionHtml('Learning', `
        <ul class="settings-list">
            <li class="settings-row">
                <span class="settings-row__label" id="sessionSizeLabel">Words per session</span>
                <div class="stepper" role="group" aria-labelledby="sessionSizeLabel">
                    <button type="button" class="stepper__btn" aria-label="Fewer words" data-action="session-size-step" data-arg="-1" data-testid="session-size-dec">−</button>
                    <span class="stepper__value" aria-live="polite" data-testid="session-size-value">${sessionSize}</span>
                    <button type="button" class="stepper__btn" aria-label="More words" data-action="session-size-step" data-arg="1" data-testid="session-size-inc">+</button>
                </div>
            </li>
            ${switchRowHtml({ label: 'Sound', id: 'speechToggle', testId: 'speech-toggle' })}
            ${switchRowHtml({ label: 'Auto play', id: 'autoPlayToggle', testId: 'autoplay-toggle' })}
            ${switchRowHtml({ label: 'Show definition instead of translation', id: 'showDefinitionToggle', testId: 'show-definition-toggle', action: 'toggle-show-definition' })}
        </ul>
    `);
}

function appearanceHtml(theme) {
    const options = THEMES.map(({ key, label }) => `<button type="button" class="segmented__option" aria-pressed="${key === theme}" data-action="set-theme" data-arg="${key}" data-testid="theme-${key}">${label}</button>`).join('');
    return sectionHtml('Appearance', `<div class="segmented" role="group" aria-label="Theme">${options}</div>`);
}

function cloudHtml() {
    return sectionHtml('Cloud backup', '<div class="settings-card" id="cloudBackup"></div>');
}

function dataHtml(snapshotDate) {
    const undo = snapshotDate
        ? actionRowHtml({ label: `Undo last restore (${snapshotDate})`, iconName: 'undo', action: 'undo-restore', testId: 'undo-restore-btn' })
        : '';
    return sectionHtml('Data on this device', `
        <ul class="settings-list">
            ${actionRowHtml({ label: 'Back up to file', iconName: 'download', testId: 'backup-btn' })}
            ${actionRowHtml({ label: 'Restore from file', iconName: 'upload', testId: 'restore-btn' })}
            ${undo}
        </ul>
        <p class="settings-note">Words are stored locally on this device.</p>
    `);
}

function diagnosticsHtml() {
    return sectionHtml('Diagnostics', `
        <ul class="settings-list">
            ${switchRowHtml({ label: 'Logging', id: 'logToggle', testId: 'log-toggle-btn', action: 'toggle-logging' })}
            ${actionRowHtml({ label: 'Save logs', iconName: 'file', action: 'save-logs', testId: 'save-logs-btn' })}
        </ul>
        <p class="settings-note">Turn logging on, reproduce the problem, then save the logs to a file.</p>
    `);
}

function renderSettingsHtml({ sessionSize, theme, snapshotDate }) {
    return `
        <header class="settings-header">
            <button type="button" class="settings-header__back" aria-label="Back to Progress" data-action="close-settings" data-testid="settings-back-btn">${icon('chevronLeft', 24)}</button>
            <h3>Settings</h3>
        </header>
        ${learningHtml(sessionSize)}
        ${appearanceHtml(theme)}
        ${cloudHtml()}
        ${dataHtml(snapshotDate)}
        ${diagnosticsHtml()}
        <p class="settings-version" data-testid="app-version">${getVersionLabel()}</p>
    `;
}

function updateSessionSizeControl(container, size) {
    container.querySelector('[data-testid="session-size-value"]').textContent = size;
    container.querySelector('[data-testid="session-size-dec"]').disabled = size <= MIN_SESSION_SIZE;
    container.querySelector('[data-testid="session-size-inc"]').disabled = size >= MAX_SESSION_SIZE;
}

module.exports = { renderSettingsHtml, updateSessionSizeControl };
