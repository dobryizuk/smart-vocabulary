// ============================================================================
// TODAY SCREEN: streak, words ready for review, vocabulary buckets and tricky words
// ============================================================================

const SpacedRepetition = require('./spaced-repetition.js');
const Metrics = require('./progress-metrics.js');
const WordList = require('./word-list.js');
const UIComponents = require('./ui-components.js');
const sessionSettings = require('./session-settings.js');
const { icon } = require('./icons.js');

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function formatDate(now) {
    return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatNextReview(date, now) {
    const label = WordList.formatRelativeDate(date, now);
    if (label !== 'Today') return label;
    return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function headerHtml(streak, now) {
    return `
        <header class="today-header">
            <div>
                <p class="today-header__date" data-testid="today-date">${formatDate(now)}</p>
                <h3>Today</h3>
            </div>
            <div class="streak-chip" data-testid="today-streak">${icon('flame', 18)}<span>${streak}-day streak</span></div>
        </header>
    `;
}

function reviewCardHtml(words, sessionSize, now) {
    const { reviews, fresh } = Metrics.getReviewBreakdown(words, now);
    const due = reviews + fresh;
    const minutes = Metrics.estimateSessionMinutes(due, sessionSize);
    return `
        <section class="review-card" data-testid="today-review">
            <div class="review-card__body">
                <p class="review-card__eyebrow">Ready for review</p>
                <p class="review-card__count" data-testid="today-due">${plural(due, 'word')}</p>
                <p class="review-card__detail" data-testid="today-breakdown">${plural(reviews, 'review')} · ${fresh} new · about ${minutes} min</p>
            </div>
            <button type="button" class="review-card__start" data-action="start-learning" data-testid="start-session-btn">Start session${icon('arrowRight', 18)}</button>
        </section>
    `;
}

function emptyReviewHtml(words, now) {
    const hasWords = words.length > 0;
    const nextReview = Metrics.getNextReviewDate(words, now);
    const nextHtml = nextReview ? `<br>Next review: <span data-testid="today-next-review">${formatNextReview(nextReview, now)}</span>` : '';
    const title = hasWords ? 'Great job!' : 'Ready to learn!';
    const subtitle = hasWords
        ? 'No words need review right now. Start a new session to practice.'
        : 'Add some words first, then start a new session.';
    return `<div data-testid="today-empty">${UIComponents.createEmptyState(title, subtitle + nextHtml, [
        { text: 'Start New Session', action: 'force-start-learning', type: 'primary' }
    ])}</div>`;
}

function vocabularyHtml(words) {
    const counts = Metrics.getStatusCounts(words);
    const entries = Object.entries(SpacedRepetition.STATUS_LABELS);
    const segments = entries.filter(([key]) => counts[key] > 0)
        .map(([key]) => `<div class="vocab-bar__segment progress-bucket__swatch--${key}" style="flex: ${counts[key]}"></div>`).join('');
    const buckets = entries.map(([key, label]) => `
        <div class="vocab-bucket" data-testid="today-bucket-${key}">
            <span class="progress-bucket__value">${counts[key]}</span>
            <span class="progress-bucket__label"><span class="progress-bucket__swatch progress-bucket__swatch--${key}"></span>${label}</span>
        </div>
    `).join('');
    return `
        <section class="today-card" data-testid="today-vocabulary">
            <div class="today-card__head">
                <h2 class="today-card__title">Your vocabulary</h2>
                <span class="today-card__aside" data-testid="today-total">${plural(words.length, 'word')}</span>
            </div>
            <div class="vocab-bar" aria-hidden="true">${segments}</div>
            <div class="vocab-buckets">${buckets}</div>
        </section>
    `;
}

function trickyRowHtml({ word, percentRight, status }) {
    const warnClass = status.key === 'difficult' ? ' tricky-row__chip--warn' : '';
    return `
        <li class="tricky-row" data-testid="tricky-word">
            <div class="tricky-row__text">
                <span class="tricky-row__original">${UIComponents.escapeHtml(word.original)}</span>
                <span class="tricky-row__translation">${UIComponents.escapeHtml(word.translation || '')}</span>
            </div>
            <span class="tricky-row__chip${warnClass}">${percentRight}% right</span>
        </li>
    `;
}

function trickyHtml(words) {
    const tricky = Metrics.getTrickyWords(words);
    if (tricky.length === 0) return '';
    return `
        <section class="today-section" data-testid="today-tricky">
            <div class="today-section__head">
                <h2 class="today-card__title">Tricky words</h2>
                <button type="button" class="today-section__link" data-action="show-words" data-arg="difficult" data-testid="tricky-see-all">See all</button>
            </div>
            <ul class="tricky-list">${tricky.map(trickyRowHtml).join('')}</ul>
        </section>
    `;
}

function renderTodayHtml({ words, sessionSize, now }) {
    const isDue = Metrics.countDue(words, now) > 0;
    const reviewHtml = isDue ? reviewCardHtml(words, sessionSize, now) : emptyReviewHtml(words, now);
    const overviewHtml = words.length > 0 ? vocabularyHtml(words) + trickyHtml(words) : '';
    return headerHtml(Metrics.getDayStreaks(words, now).current, now) + reviewHtml + overviewHtml;
}

function createToday(context) {
    const ctx = context ?? {};
    const getVocabulary = ctx.getVocabulary ?? (() => []);
    const getSessionSize = ctx.getSessionSize ?? (() => sessionSettings.DEFAULT_SESSION_SIZE);
    const doc = ctx.document ?? (typeof document !== 'undefined' ? document : null);
    const getNow = ctx.getNow ?? (() => new Date());

    function update() {
        const container = doc?.getElementById('todayView');
        if (!container) return;
        const vocabulary = getVocabulary();
        const words = Array.isArray(vocabulary) ? vocabulary : [];
        container.innerHTML = renderTodayHtml({ words, sessionSize: getSessionSize(), now: getNow() });
    }

    // The Today tab holds the overview and, in place of it, a running learning session
    function show(view) {
        const overview = doc?.getElementById('todayView');
        const session = doc?.getElementById('learningContent');
        if (overview) overview.hidden = view !== 'overview';
        if (session) session.hidden = view !== 'session';
        const tab = doc?.getElementById('today-tab');
        if (tab) tab.scrollTop = 0;
    }

    function showOverview() {
        update();
        show('overview');
    }

    function showSession() {
        show('session');
    }

    return { update, showOverview, showSession };
}

function createDefaultToday() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createToday({
        getVocabulary: () => g.SV?.DataManager?.vocabulary ?? [],
        getSessionSize: sessionSettings.getSessionSize,
        document: (typeof document !== 'undefined' ? document : null)
    });
}

const defaultToday = createDefaultToday();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultToday;
    module.exports.createToday = createToday;
    module.exports.renderTodayHtml = renderTodayHtml;
}
