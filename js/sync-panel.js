// ============================================================================
// CLOUD BACKUP PANEL (Stats tab): the sign-in form, or the account and its sync status
// ============================================================================

const UIComponents = require('./ui-components.js');

const PANEL_STYLE = 'background: var(--color-surface); padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 16px; border: 1px solid var(--color-border);';
const TEXT_STYLE = 'margin: 6px 0 0;';
const SMALL_TEXT_STYLE = `font-size: 0.8em; color: #666; ${TEXT_STYLE}`;

function statusText(status) {
    if (status.state === 'syncing') return 'Syncing…';
    if (status.state === 'error') return `Not synced: ${status.error}`;
    return `Synced ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function panelHtml(content) {
    return `
        <div style="${PANEL_STYLE}">
            <h4 style="margin-bottom: 8px; font-size: 1.1em;">Cloud backup</h4>
            ${content}
        </div>
    `;
}

function signedOutHtml() {
    return panelHtml(`
        <form data-testid="sync-sign-in-form" style="display: flex; flex-direction: column; gap: 6px;">
            <input class="form-control" type="email" name="username" autocomplete="username" placeholder="Email" required data-testid="sync-email">
            <input class="form-control" type="password" name="password" autocomplete="current-password" placeholder="Password" required data-testid="sync-password">
            ${UIComponents.createButton('Sign in', '', 'primary', false, '', 'padding: 8px 12px; font-size: 0.85em;', '', 'sync-sign-in-btn')}
        </form>
        <div data-testid="sync-error" role="alert" style="font-size: 0.8em; color: #dc3545; ${TEXT_STYLE}"></div>
        ${UIComponents.createSmallText('Optional: keep a copy of your words on the server and on your other devices.', '#666', '0.75em', TEXT_STYLE)}
    `);
}

function signedInHtml() {
    return panelHtml(`
        <div data-testid="sync-email-text" style="font-size: 0.9em;"></div>
        <div data-testid="sync-status" aria-live="polite" style="${SMALL_TEXT_STYLE}"></div>
        ${UIComponents.createButton('Sign out', '', 'secondary', false, '', 'margin-top: 8px; padding: 8px 12px; font-size: 0.85em;', '', 'sync-sign-out-btn')}
    `);
}

function bindSignIn(container, sync) {
    const form = container.querySelector('[data-testid="sync-sign-in-form"]');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        await sync.signIn(form.elements.username.value.trim(), form.elements.password.value);
        button.disabled = false;
    });
}

// Rebuilds the markup only when signing in or out, so typed input survives status updates
function renderSyncPanel(container, status, sync) {
    const mode = status.state === 'signed-out' ? 'signed-out' : 'signed-in';
    if (container.dataset.mode !== mode) {
        container.dataset.mode = mode;
        container.innerHTML = mode === 'signed-out' ? signedOutHtml() : signedInHtml();
        if (mode === 'signed-out') bindSignIn(container, sync);
        else container.querySelector('[data-testid="sync-sign-out-btn"]').addEventListener('click', () => sync.signOut());
    }
    const text = (testId) => container.querySelector(`[data-testid="${testId}"]`);
    if (mode === 'signed-out') {
        text('sync-error').textContent = status.error || '';
        return;
    }
    text('sync-email-text').textContent = status.email || '';
    text('sync-status').textContent = statusText(status);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.renderSyncPanel = renderSyncPanel;
}
