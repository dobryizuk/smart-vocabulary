// ============================================================================
// WORD LIST - status, filters, grouping and rendering of the My words screen
// ============================================================================

const SpacedRepetition = require('./spaced-repetition.js');
const UIComponents = require('./ui-components.js');
const { icon } = require('./icons.js');
const { getWordStatus } = SpacedRepetition;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RELATIVE_DATE_LIMIT_DAYS = 30;

const hasStatus = (statusKey) => (word) => getWordStatus(word).key === statusKey;

const FILTERS = [
    { key: 'all', label: 'All', matches: () => true },
    { key: 'due', label: 'Due', counted: true, matches: SpacedRepetition.isDue },
    { key: 'difficult', label: 'Difficult', counted: true, matches: hasStatus('difficult') },
    { key: 'mastered', label: 'Mastered', matches: hasStatus('mastered') }
];

function findFilter(filterKey) {
    return FILTERS.find(filter => filter.key === filterKey) ?? FILTERS[0];
}

function filterWords(words, filterKey, now = new Date()) {
    const { matches } = findFilter(filterKey);
    return words.filter(word => matches(word, now));
}

function groupWords(words, now = new Date()) {
    const byCreatedDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    const byNextReview = (a, b) => new Date(a.nextReview) - new Date(b.nextReview);
    const due = words.filter(word => SpacedRepetition.isDue(word, now)).sort(byCreatedDesc);
    const upcoming = words.filter(word => !SpacedRepetition.isDue(word, now)).sort(byNextReview);
    return { due, upcoming };
}

function formatRelativeDate(nextReview, now = new Date()) {
    const date = new Date(nextReview);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((startOfDay(date) - startOfDay(now)) / MS_PER_DAY);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= RELATIVE_DATE_LIMIT_DAYS) return `In ${days} days`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderFilters(words, activeKey, now = new Date()) {
    const active = findFilter(activeKey).key;
    return FILTERS.map(({ key, label, counted }) => {
        const count = counted ? ` · ${filterWords(words, key, now).length}` : '';
        const isActive = key === active;
        const activeClass = isActive ? ' word-filter--active' : '';
        return `<button type="button" class="word-filter${activeClass}" data-action="set-word-filter" data-arg="${key}" data-testid="word-filter-${key}" aria-pressed="${isActive}">${label}${count}</button>`;
    }).join('');
}

function buildActions(word) {
    return [
        { type: 'warning', icon: icon('pencil'), action: 'edit-word', arg: word.id, title: 'Edit word' },
        { type: 'danger', icon: icon('trash'), action: 'delete-word', arg: word.id, title: 'Delete word' },
        UIComponents.createSpeakAction(word.original)
    ];
}

function renderGroup(key, title, rowsHtml) {
    if (!rowsHtml) return '';
    return `<section class="word-group" data-testid="word-group-${key}"><h2 class="word-group__title">${title}</h2><div class="word-group__rows">${rowsHtml}</div></section>`;
}

function renderGroups(words, now = new Date()) {
    const { due, upcoming } = groupWords(words, now);
    const renderRow = (word, reviewLabel) => UIComponents.createWordCard(word, 'compact', buildActions(word), true, reviewLabel);
    const dueHtml = due.map(word => renderRow(word, '')).join('');
    const upcomingHtml = upcoming.map(word => renderRow(word, formatRelativeDate(word.nextReview, now))).join('');
    return renderGroup('due', 'Due today', dueHtml) + renderGroup('upcoming', 'Coming up', upcomingHtml);
}

module.exports = {
    filterWords,
    groupWords,
    formatRelativeDate,
    renderFilters,
    renderGroups
};
