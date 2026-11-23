import { describe, it, expect, vi, beforeEach } from 'vitest';

const { renderSyncPanel, syncStatusText } = require('../../js/sync-panel.js');

const TYPED_SECRET = 'typed secret';
const SIGNED_OUT = { state: 'signed-out', email: null, lastSyncedAt: null, error: null };
const signedIn = (patch) => ({ ...SIGNED_OUT, state: 'synced', email: 'learner@example.com', lastSyncedAt: '2026-11-22T14:05:00.000Z', ...patch });

describe('Cloud backup panel', () => {
    let container;
    let sync;
    const byTestId = (id) => container.querySelector(`[data-testid="${id}"]`);

    beforeEach(() => {
        document.body.innerHTML = '<div id="cloudBackup"></div>';
        container = document.getElementById('cloudBackup');
        sync = { signIn: vi.fn(async () => undefined), signOut: vi.fn(async () => undefined) };
    });

    it('offers a sign-in form that the password manager recognises', () => {
        renderSyncPanel(container, SIGNED_OUT, sync);

        expect(container.textContent).toContain('Sign in to cloud backup');
        expect(byTestId('sync-email').getAttribute('autocomplete')).toBe('username');
        expect(byTestId('sync-password').getAttribute('autocomplete')).toBe('current-password');
        expect(byTestId('sync-password').type).toBe('password');
        expect(byTestId('sync-error').textContent).toBe('');
    });

    it('reveals and hides the typed password', () => {
        renderSyncPanel(container, SIGNED_OUT, sync);
        const reveal = byTestId('sync-password-toggle');

        reveal.click();
        expect(byTestId('sync-password').type).toBe('text');
        expect(reveal.getAttribute('aria-pressed')).toBe('true');
        expect(reveal.getAttribute('aria-label')).toBe('Hide password');

        reveal.click();
        expect(byTestId('sync-password').type).toBe('password');
        expect(reveal.getAttribute('aria-label')).toBe('Show password');
    });

    it('signs in with the typed email and password', async () => {
        renderSyncPanel(container, SIGNED_OUT, sync);
        byTestId('sync-email').value = '  learner@example.com ';
        byTestId('sync-password').value = TYPED_SECRET;

        byTestId('sync-sign-in-btn').click();

        expect(sync.signIn).toHaveBeenCalledWith('learner@example.com', TYPED_SECRET);
        expect(byTestId('sync-sign-in-btn').disabled).toBe(true);
        await vi.waitFor(() => expect(byTestId('sync-sign-in-btn').disabled).toBe(false));
    });

    it('shows why sign-in failed and keeps the typed email', () => {
        renderSyncPanel(container, SIGNED_OUT, sync);
        byTestId('sync-email').value = 'learner@example.com';

        renderSyncPanel(container, { ...SIGNED_OUT, error: 'Invalid login credentials' }, sync);

        expect(byTestId('sync-error').textContent).toBe('Invalid login credentials');
        expect(byTestId('sync-email').value).toBe('learner@example.com');
    });

    it('shows the account and the time of the last sync when signed in', () => {
        renderSyncPanel(container, signedIn(), sync);

        expect(byTestId('sync-sign-in-form')).toBeNull();
        expect(byTestId('sync-email-text').textContent).toBe('learner@example.com');
        const time = new Date('2026-11-22T14:05:00.000Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        expect(byTestId('sync-status').textContent).toBe(`Synced ${time}`);
    });

    it.each([
        ['syncing', signedIn({ state: 'syncing' }), 'Syncing…'],
        ['an error', signedIn({ state: 'error', error: 'Load failed' }), 'Not synced: Load failed'],
        ['an error before any sync', signedIn({ state: 'error', error: 'project paused', lastSyncedAt: null }), 'Not synced: project paused']
    ])('describes %s', (_, status, text) => {
        renderSyncPanel(container, status, sync);
        expect(byTestId('sync-status').textContent).toBe(text);
    });

    it('shows server text as text, not markup', () => {
        renderSyncPanel(container, signedIn({ state: 'error', error: '<img src=x onerror=alert(1)>' }), sync);
        expect(container.querySelector('img')).toBeNull();
        expect(byTestId('sync-status').textContent).toContain('<img');
    });

    it('syncs on demand and blocks the button while a sync runs', () => {
        sync.sync = vi.fn(async () => undefined);
        renderSyncPanel(container, signedIn(), sync);
        expect(byTestId('sync-now-btn').disabled).toBe(false);

        byTestId('sync-now-btn').click();
        expect(sync.sync).toHaveBeenCalledTimes(1);

        renderSyncPanel(container, signedIn({ state: 'syncing' }), sync);
        expect(byTestId('sync-now-btn').disabled).toBe(true);
        renderSyncPanel(container, signedIn(), sync);
        expect(byTestId('sync-now-btn').disabled).toBe(false);
    });

    it('signs out from the button and returns to the form', () => {
        renderSyncPanel(container, signedIn(), sync);

        byTestId('sync-sign-out-btn').click();
        expect(sync.signOut).toHaveBeenCalledTimes(1);

        renderSyncPanel(container, SIGNED_OUT, sync);
        expect(byTestId('sync-sign-in-form')).not.toBeNull();
    });
});

describe('syncStatusText', () => {
    it('tells that nobody is signed in', () => {
        expect(syncStatusText(SIGNED_OUT)).toBe('Not signed in');
    });
});

