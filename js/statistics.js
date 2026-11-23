// ============================================================================
// PROGRESS SCREEN: streak, status buckets, answers of the week and the way to Settings
// ============================================================================

const SpacedRepetition = require('./spaced-repetition.js');
const Metrics = require('./progress-metrics.js');
const { icon } = require('./icons.js');
const { syncStatusText } = require('./sync-panel.js');

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MIN_BAR_PERCENT = 4;

function streakTileHtml(streaks) {
    return `
        <div class="progress-tile progress-tile--streak" data-testid="progress-streak">
            ${icon('flame', 22)}
            <span class="progress-tile__value" data-testid="progress-streak-current">${streaks.current}</span>
            <span class="progress-tile__label">day streak · best <span data-testid="progress-streak-best">${streaks.best}</span></span>
        </div>
    `;
}

function totalTileHtml(total) {
    return `
        <div class="progress-tile" data-testid="progress-total">
            <span class="progress-tile__icon">${icon('book', 22)}</span>
            <span class="progress-tile__value" data-testid="progress-total-value">${total}</span>
            <span class="progress-tile__label">${total === 1 ? 'word' : 'words'}</span>
        </div>
    `;
}

function bucketsHtml(counts) {
    return Object.entries(SpacedRepetition.STATUS_LABELS).map(([key, label]) => `
        <div class="progress-bucket" data-testid="progress-bucket-${key}">
            <span class="progress-bucket__value">${counts[key]}</span>
            <span class="progress-bucket__label"><span class="progress-bucket__swatch progress-bucket__swatch--${key}"></span>${label}</span>
        </div>
    `).join('');
}

function needReviewHtml(due) {
    return `
        <div class="progress-bucket progress-bucket--wide" data-testid="progress-due">
            <span class="progress-bucket__value">${due}</span>
            <span class="progress-bucket__label">Need review</span>
        </div>
    `;
}

function weekChartHtml(days) {
    const total = days.reduce((sum, day) => sum + day.count, 0);
    const peak = Math.max(...days.map(day => day.count), 1);
    const summary = days.map(day => `${WEEKDAY_NAMES[day.weekday]} ${day.count}`).join(', ');
    const bars = days.map(day => {
        const height = day.count === 0 ? MIN_BAR_PERCENT : Math.max(MIN_BAR_PERCENT, Math.round((day.count / peak) * 100));
        const todayClass = day.isToday ? ' week-chart__day--today' : '';
        return `
            <div class="week-chart__day${todayClass}" data-testid="week-day" data-count="${day.count}">
                <div class="week-chart__track"><div class="week-chart__bar" style="height: ${height}%"></div></div>
                <span class="week-chart__letter">${WEEKDAY_LETTERS[day.weekday]}</span>
            </div>
        `;
    }).join('');
    return `
        <section class="progress-card" data-testid="progress-week">
            <div class="progress-card__head">
                <h2 class="progress-card__title">Reviews this week</h2>
                <span class="progress-card__aside" data-testid="progress-week-total">${total} total</span>
            </div>
            <div class="week-chart" role="img" aria-label="Reviews per day: ${summary}">${bars}</div>
        </section>
    `;
}

function linkRowHtml({ testId, iconName, label, detail }) {
    return `
        <li><button type="button" class="progress-link" data-action="open-settings" data-testid="${testId}">
            <span class="progress-link__label">${icon(iconName)}${label}</span>
            <span class="progress-link__detail">${detail}${icon('chevronRight', 16)}</span>
        </button></li>
    `;
}

function renderProgressHtml({ words, syncStatus, now }) {
    return `
        <h3>Progress</h3>
        <div class="progress-pair">${streakTileHtml(Metrics.getDayStreaks(words, now))}${totalTileHtml(words.length)}</div>
        <div class="progress-buckets">${bucketsHtml(Metrics.getStatusCounts(words))}${needReviewHtml(Metrics.countDue(words, now))}</div>
        ${weekChartHtml(Metrics.getWeeklyCounts(words, now))}
        <ul class="progress-links">
            ${linkRowHtml({ testId: 'progress-cloud-row', iconName: 'cloud', label: 'Cloud backup', detail: `<span data-testid="progress-cloud-status">${syncStatusText(syncStatus)}</span>` })}
            ${linkRowHtml({ testId: 'open-settings-btn', iconName: 'settings', label: 'Settings', detail: 'Learning · theme · data' })}
        </ul>
    `;
}

function createStatistics(context) {
    const ctx = context ?? {};
    const getVocabulary = ctx.getVocabulary ?? (() => []);
    const getSyncStatus = ctx.getSyncStatus ?? (() => ({ state: 'signed-out' }));
    const doc = ctx.document ?? (typeof document !== 'undefined' ? document : null);
    const getNow = ctx.getNow ?? (() => new Date());

    function updateStats() {
        const container = doc?.getElementById('progressView');
        if (!container) return;
        const vocabulary = getVocabulary();
        const words = Array.isArray(vocabulary) ? vocabulary : [];
        container.innerHTML = renderProgressHtml({ words, syncStatus: getSyncStatus(), now: getNow() });
    }

    return { updateStats };
}

function createDefaultStatistics() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createStatistics({
        getVocabulary: () => g.SV?.DataManager?.vocabulary ?? [],
        getSyncStatus: () => g.SV?.Sync?.getStatus?.() ?? { state: 'signed-out' },
        document: (typeof document !== 'undefined' ? document : null)
    });
}

const defaultStatistics = createDefaultStatistics();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultStatistics;
    module.exports.createStatistics = createStatistics;
}
