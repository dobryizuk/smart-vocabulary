import { describe, it, expect, beforeEach } from 'vitest';

const { createStatistics } = require('../../js/statistics.js');

const NOW = new Date(2026, 10, 20, 10, 0);
const day = (daysAgo, hour = 12) => new Date(2026, 10, 20 - daysAgo, hour).toISOString();
const answer = (daysAgo, difficulty) => ({ date: day(daysAgo), difficulty });

const VOCABULARY = [
    { id: 'm', original: 'mastered', nextReview: '2026-12-30T00:00:00.000Z', reviewHistory: [answer(2, 'easy'), answer(1, 'perfect'), answer(0, 'easy')] },
    { id: 'l', original: 'learning', nextReview: '2026-12-30T00:00:00.000Z', reviewHistory: [answer(1, 'hard'), answer(0, 'easy'), answer(0, 'medium')] },
    { id: 'd', original: 'difficult', nextReview: '2020-01-01T00:00:00.000Z', reviewHistory: [answer(3, 'hard')] },
    { id: 'n', original: 'fresh', nextReview: null, reviewHistory: [] }
];

describe('Progress screen', () => {
    let vocabulary;
    let syncStatus;
    let stats;
    const byTestId = (testId) => document.querySelector(`[data-testid="${testId}"]`);
    const text = (testId) => byTestId(testId).textContent.replace(/\s+/g, ' ').trim();

    beforeEach(() => {
        document.body.innerHTML = '<div id="progressView"></div>';
        vocabulary = VOCABULARY;
        syncStatus = { state: 'signed-out' };
        stats = createStatistics({
            getVocabulary: () => vocabulary,
            getSyncStatus: () => syncStatus,
            getNow: () => NOW,
            document
        });
    });

    it('shows the streak and the best streak', () => {
        stats.updateStats();

        expect(text('progress-streak-current')).toBe('4');
        expect(text('progress-streak-best')).toBe('4');
        expect(text('progress-streak')).toContain('day streak');
    });

    it('shows the word total', () => {
        stats.updateStats();

        expect(text('progress-total-value')).toBe('4');
        expect(text('progress-total')).toContain('words');
    });

    it('buckets the words by the status chips and counts the words that need review', () => {
        stats.updateStats();

        expect(text('progress-bucket-mastered')).toBe('1 Mastered');
        expect(text('progress-bucket-learning')).toBe('1 Learning');
        expect(text('progress-bucket-difficult')).toBe('1 Difficult');
        expect(text('progress-bucket-new')).toBe('1 New');
        expect(text('progress-due')).toBe('2 Need review');
    });

    it('draws one bar per day of the last week with the answers of each', () => {
        stats.updateStats();

        const bars = [...document.querySelectorAll('[data-testid="week-day"]')];
        expect(bars.map(bar => bar.dataset.count)).toEqual(['0', '0', '0', '1', '1', '2', '3']);
        expect(text('progress-week-total')).toBe('7 total');
        expect(bars.at(-1).classList.contains('week-chart__day--today')).toBe(true);
        expect(document.querySelector('.week-chart').getAttribute('aria-label')).toMatch(/^Reviews per day: \w{3} 0, .* \w{3} 3$/);
    });

    it('keeps an empty bar visible and scales the busiest day to the full height', () => {
        stats.updateStats();

        const heights = [...document.querySelectorAll('.week-chart__bar')].map(bar => bar.style.height);
        expect(heights[0]).toBe('4%');
        expect(heights.at(-1)).toBe('100%');
    });

    it('shows the sync status in the Cloud backup row and opens Settings from both rows', () => {
        syncStatus = { state: 'synced', lastSyncedAt: '2026-11-20T09:40:00.000Z' };
        stats.updateStats();

        expect(text('progress-cloud-status')).toMatch(/^Synced \d/);
        expect(byTestId('progress-cloud-row').dataset.action).toBe('open-settings');
        expect(byTestId('open-settings-btn').dataset.action).toBe('open-settings');
    });

    it('says when the user is not signed in', () => {
        stats.updateStats();

        expect(text('progress-cloud-status')).toBe('Not signed in');
    });

    it('shows a sync error from the server as text', () => {
        syncStatus = { state: 'error', error: '<b>Bad</b> "gateway" & more' };
        stats.updateStats();

        expect(text('progress-cloud-status')).toBe('Not synced: <b>Bad</b> "gateway" & more');
        expect(byTestId('progress-cloud-status').querySelector('b')).toBeNull();
    });

    it('renders an empty vocabulary with zeros and an empty chart', () => {
        vocabulary = [];
        stats.updateStats();

        expect(text('progress-streak-current')).toBe('0');
        expect(text('progress-total-value')).toBe('0');
        expect(text('progress-due')).toBe('0 Need review');
        expect(text('progress-week-total')).toBe('0 total');
    });

    it('tolerates a vocabulary that is not an array and a missing container', () => {
        vocabulary = undefined;
        expect(() => stats.updateStats()).not.toThrow();
        expect(text('progress-total-value')).toBe('0');

        document.body.innerHTML = '';
        expect(() => stats.updateStats()).not.toThrow();
    });

    it('does not leak a global window.Statistics', () => {
        expect(global.Statistics).toBeUndefined();
    });
});
