// ============================================================================
// CLOUD BACKUP PANEL (Settings): the sign-in form, or the account and its sync status
// ============================================================================

const { icon } = require('./icons.js');

function syncStatusText(status) {
    if (status.state === 'signed-out') return 'Not signed in';
    if (status.state === 'syncing') return 'Syncing…';
    if (status.state === 'error') return `Not synced: ${status.error}`;
    return `Synced ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function signedOutHtml() {
    return `
        <form class="signin" data-testid="sync-sign-in-form">
            <div class="signin__icon">${icon('cloud', 28)}</div>
            <h3 class="signin__title">Sign in to cloud backup</h3>
            <p class="signin__lead">Keep your words safe and synced across your devices.</p>
            <div class="signin__field">
                <label class="signin__label" for="syncEmail">Login</label>
                <input class="signin__input" id="syncEmail" type="email" name="username" autocomplete="username" placeholder="you@example.com" required data-testid="sync-email">
            </div>
            <div class="signin__field">
                <label class="signin__label" for="syncPassword">Password</label>
                <div class="signin__password">
                    <input class="signin__input signin__input--bare" id="syncPassword" type="password" name="password" autocomplete="current-password" required data-testid="sync-password">
                    <button type="button" class="signin__reveal" aria-label="Show password" aria-pressed="false" data-testid="sync-password-toggle">${icon('eye')}</button>
                </div>
            </div>
            <button type="submit" class="signin__submit" data-testid="sync-sign-in-btn">Sign in</button>
            <div class="signin__error" data-testid="sync-error" role="alert"></div>
            <p class="signin__note">Accounts are created by the admin. Your words stay on this device until you sign in.</p>
        </form>
    `;
}

function signedInHtml() {
    return `
        <div class="account">
            <div class="account__who">
                <div class="account__avatar">${icon('cloud')}</div>
                <div class="account__text">
                    <span class="account__email" data-testid="sync-email-text"></span>
                    <span class="account__status" data-testid="sync-status" aria-live="polite"></span>
                </div>
            </div>
            <div class="account__actions">
                <button type="button" class="account__action" data-testid="sync-now-btn">Sync now</button>
                <button type="button" class="account__action account__action--danger" data-testid="sync-sign-out-btn">Sign out</button>
            </div>
        </div>
    `;
}

function bindSignIn(container, sync) {
    const form = container.querySelector('[data-testid="sync-sign-in-form"]');
    const submit = form.querySelector('[data-testid="sync-sign-in-btn"]');
    const password = form.elements.password;
    const reveal = form.querySelector('[data-testid="sync-password-toggle"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        await sync.signIn(form.elements.username.value.trim(), password.value);
        submit.disabled = false;
    });
    reveal.addEventListener('click', () => {
        const hidden = password.type === 'password';
        password.type = hidden ? 'text' : 'password';
        reveal.setAttribute('aria-pressed', String(hidden));
        reveal.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    });
}

function bindSignedIn(container, sync) {
    const byTestId = (testId) => container.querySelector(`[data-testid="${testId}"]`);
    byTestId('sync-now-btn').addEventListener('click', () => sync.sync());
    byTestId('sync-sign-out-btn').addEventListener('click', () => sync.signOut());
}

// Rebuilds the markup only when signing in or out, so typed input survives status updates
function renderSyncPanel(container, status, sync) {
    const mode = status.state === 'signed-out' ? 'signed-out' : 'signed-in';
    if (container.dataset.mode !== mode) {
        container.dataset.mode = mode;
        container.innerHTML = mode === 'signed-out' ? signedOutHtml() : signedInHtml();
        if (mode === 'signed-out') bindSignIn(container, sync);
        else bindSignedIn(container, sync);
    }
    const byTestId = (testId) => container.querySelector(`[data-testid="${testId}"]`);
    if (mode === 'signed-out') {
        byTestId('sync-error').textContent = status.error || '';
        return;
    }
    byTestId('sync-email-text').textContent = status.email || '';
    byTestId('sync-status').textContent = syncStatusText(status);
    byTestId('sync-now-btn').disabled = status.state === 'syncing';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.renderSyncPanel = renderSyncPanel;
    module.exports.syncStatusText = syncStatusText;
}
