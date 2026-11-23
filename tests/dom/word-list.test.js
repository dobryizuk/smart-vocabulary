import { describe, it, expect, beforeEach } from 'vitest';
import { renderToDOM, getTextContent } from './test-helpers.js';

const WordList = require('../../js/word-list.js');
const SpacedRepetition = require('../../js/spaced-repetition.js');
const UIComponents = require('../../js/ui-components.js');
const { icon } = require('../../js/icons.js');
const AppMain = require('../../js/app-main.js');

const NOW = new Date(2026, 10, 10, 12, 0, 0);
const daysFromNow = (days, hour = 9) => new Date(2026, 10, 10 + days, hour, 0, 0).toISOString();

const history = (...difficulties) => difficulties.map(difficulty => ({ difficulty }));
const NEW = [];
const DIFFICULT = history('hard', 'hard', 'medium');
const LEARNING = history('easy', 'hard');
const MASTERED = history('easy', 'perfect', 'easy');

const word = (id, overrides = {}) => ({
    id,
    original: id,
    translation: `${id}-tr`,
    reviewHistory: LEARNING,
    nextReview: daysFromNow(3),
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const ids = (words) => words.map(w => w.id);

describe('filterWords', () => {
    const words = [
        word('fresh', { reviewHistory: NEW, nextReview: null }),
        word('struggling', { reviewHistory: DIFFICULT, nextReview: daysFromNow(-1) }),
        word('known', { reviewHistory: LEARNING, nextReview: daysFromNow(4) }),
        word('master', { reviewHistory: MASTERED, nextReview: daysFromNow(60) })
    ];

    it('keeps every word for all', () => {
        expect(ids(WordList.filterWords(words, 'all', NOW))).toEqual(['fresh', 'struggling', 'known', 'master']);
    });

    it('keeps words that are new or whose review date has come for due', () => {
        expect(ids(WordList.filterWords(words, 'due', NOW))).toEqual(['fresh', 'struggling']);
    });

    it('keeps words with the learning status for difficult', () => {
        expect(ids(WordList.filterWords(words, 'difficult', NOW))).toEqual(['struggling']);
    });

    it('keeps words with the mastered status for mastered', () => {
        expect(ids(WordList.filterWords(words, 'mastered', NOW))).toEqual(['master']);
    });

    it('falls back to all for an unknown filter', () => {
        expect(WordList.filterWords(words, 'bogus', NOW)).toHaveLength(4);
    });

    it('returns nothing for an empty vocabulary', () => {
        expect(WordList.filterWords([], 'due', NOW)).toEqual([]);
    });

    it('selects due words exactly like the session does', () => {
        const session = SpacedRepetition.createSpacedRepetition({ getVocabulary: () => words });

        expect(ids(WordList.filterWords(words, 'due', new Date()))).toEqual(ids(session.getWordsForReview()));
    });
});

describe('groupWords', () => {
    it('splits due words from upcoming ones', () => {
        const { due, upcoming } = WordList.groupWords([
            word('later', { nextReview: daysFromNow(5) }),
            word('fresh', { nextReview: null }),
            word('overdue', { nextReview: daysFromNow(-2) })
        ], NOW);

        expect(ids(due).sort()).toEqual(['fresh', 'overdue']);
        expect(ids(upcoming)).toEqual(['later']);
    });

    it('lists due words with the newest added first', () => {
        const { due } = WordList.groupWords([
            word('old', { nextReview: null, createdAt: '2026-01-01T00:00:00.000Z' }),
            word('recent', { nextReview: null, createdAt: '2026-06-01T00:00:00.000Z' })
        ], NOW);

        expect(ids(due)).toEqual(['recent', 'old']);
    });

    it('sorts upcoming words by nextReview, soonest first', () => {
        const { upcoming } = WordList.groupWords([
            word('c', { nextReview: daysFromNow(9) }),
            word('a', { nextReview: daysFromNow(1) }),
            word('b', { nextReview: daysFromNow(2) })
        ], NOW);

        expect(ids(upcoming)).toEqual(['a', 'b', 'c']);
    });

    it('returns empty groups for no words', () => {
        expect(WordList.groupWords([], NOW)).toEqual({ due: [], upcoming: [] });
    });
});

describe('formatRelativeDate', () => {
    it.each([
        [0, 'Today'],
        [1, 'Tomorrow'],
        [2, 'In 2 days'],
        [30, 'In 30 days']
    ])('describes %i days ahead as %s', (days, text) => {
        expect(WordList.formatRelativeDate(daysFromNow(days), NOW)).toBe(text);
    });

    it('counts calendar days, not 24-hour spans', () => {
        const lateEvening = new Date(2026, 10, 10, 23, 30, 0);

        expect(WordList.formatRelativeDate(daysFromNow(1, 0), lateEvening)).toBe('Tomorrow');
    });

    it('shows a date beyond a month', () => {
        expect(WordList.formatRelativeDate(daysFromNow(31), NOW)).toBe('11 Dec 2026');
    });
});

describe('renderFilters', () => {
    const words = [
        word('fresh', { reviewHistory: NEW, nextReview: null }),
        word('struggling', { reviewHistory: DIFFICULT, nextReview: daysFromNow(-1) }),
        word('master', { reviewHistory: MASTERED, nextReview: daysFromNow(60) })
    ];

    it('renders the four chips with counts for due and difficult only', () => {
        const container = renderToDOM(WordList.renderFilters(words, 'all', NOW));
        const labels = Array.from(container.querySelectorAll('.word-filter')).map(getTextContent);

        expect(labels).toEqual(['All', 'Due · 2', 'Difficult · 1', 'Mastered']);
    });

    it('marks only the active chip as pressed', () => {
        const container = renderToDOM(WordList.renderFilters(words, 'due', NOW));
        const pressed = Array.from(container.querySelectorAll('[aria-pressed="true"]'));

        expect(pressed).toHaveLength(1);
        expect(pressed[0].getAttribute('data-arg')).toBe('due');
        expect(pressed[0].getAttribute('data-action')).toBe('set-word-filter');
    });
});

describe('renderGroups', () => {
    beforeEach(() => {
        window.SV = { SpacedRepetition };
    });

    const words = [
        word('fresh', { nextReview: null }),
        word('tomorrow', { nextReview: daysFromNow(1) }),
        word('soon', { nextReview: daysFromNow(2) })
    ];

    it('renders due and upcoming groups with a row per word', () => {
        const container = renderToDOM(WordList.renderGroups(words, NOW));

        const dueRows = container.querySelectorAll('[data-testid="word-group-due"] .word-card');
        const upcomingRows = container.querySelectorAll('[data-testid="word-group-upcoming"] .word-card');
        expect(getTextContent(container.querySelector('[data-testid="word-group-due"] .word-group__title'))).toBe('Due today');
        expect(getTextContent(container.querySelector('[data-testid="word-group-upcoming"] .word-group__title'))).toBe('Coming up');
        expect(dueRows).toHaveLength(1);
        expect(upcomingRows).toHaveLength(2);
    });

    it('shows word, translation, status chip and the relative date on upcoming rows', () => {
        const container = renderToDOM(WordList.renderGroups(words, NOW));
        const row = container.querySelector('[data-testid="word-group-upcoming"] .word-card');

        expect(getTextContent(row.querySelector('.word-card__original'))).toContain('tomorrow');
        expect(getTextContent(row.querySelector('.word-card__translation'))).toBe('tomorrow-tr');
        expect(getTextContent(row.querySelector('.status-badge'))).toBe('Learning');
        expect(getTextContent(row.querySelector('.word-card__review'))).toBe('Tomorrow');
    });

    it('keeps edit, delete and pronounce actions on every row', () => {
        const container = renderToDOM(WordList.renderGroups(words, NOW));
        const actions = Array.from(container.querySelectorAll('.word-card')[0].querySelectorAll('[data-action]'))
            .map(el => el.getAttribute('data-action'));

        expect(actions).toEqual(expect.arrayContaining(['edit-word', 'delete-word', 'speak-word', 'toggle-card']));
    });

    it('pronounces with the shared speaker icon instead of an emoji', () => {
        const container = renderToDOM(WordList.renderGroups(words, NOW));
        const speak = container.querySelector('.word-card [data-action="speak-word"]');

        expect(speak.querySelector('svg')).toBeTruthy();
        expect(speak.innerHTML).toBe(UIComponents.createSpeakAction('x').icon);
        expect(speak.getAttribute('data-arg')).toBe(words[0].original);
    });

    it('edits and deletes with line icons instead of emoji', () => {
        const container = renderToDOM(WordList.renderGroups(words, NOW));
        const edit = container.querySelector('.word-card [data-action="edit-word"]');
        const remove = container.querySelector('.word-card [data-action="delete-word"]');

        expect(edit.innerHTML).toBe(icon('pencil'));
        expect(remove.innerHTML).toBe(icon('trash'));
        expect(edit.textContent).toBe('');
        expect(remove.textContent).toBe('');
    });

    it('omits a group without words', () => {
        const container = renderToDOM(WordList.renderGroups([words[0]], NOW));

        expect(container.querySelector('[data-testid="word-group-upcoming"]')).toBeNull();
        expect(container.querySelector('[data-testid="word-group-due"]')).toBeTruthy();
    });

    it('renders nothing for no words', () => {
        expect(WordList.renderGroups([], NOW)).toBe('');
    });
});

describe('AppMain word list screen', () => {
    const vocabulary = [
        word('fresh', { reviewHistory: NEW, nextReview: null }),
        word('struggling', { reviewHistory: DIFFICULT, nextReview: '2020-01-01T00:00:00.000Z' }),
        word('master', { reviewHistory: MASTERED, nextReview: '2999-01-01T00:00:00.000Z' })
    ];

    beforeEach(() => {
        document.body.innerHTML = `
            <span id="wordCount"></span>
            <div id="wordFilters"></div>
            <div id="wordList"></div>
        `;
        window.SV = {
            DataManager: { vocabulary },
            UIComponents,
            SpacedRepetition,
            AppState: { wordListFilter: 'all' }
        };
    });

    const shownWords = () => Array.from(document.querySelectorAll('.word-card__original')).map(el => el.textContent.trim());

    it('shows the count, the chips and all words by default', () => {
        AppMain.renderWordList();

        expect(document.getElementById('wordCount').textContent).toBe('3');
        expect(document.querySelectorAll('.word-filter')).toHaveLength(4);
        expect(shownWords()).toHaveLength(3);
    });

    it('narrows the list to the chosen filter and keeps it pressed', () => {
        AppMain.setWordListFilter('mastered');

        expect(shownWords()).toEqual(['master']);
        expect(document.querySelector('[aria-pressed="true"]').getAttribute('data-arg')).toBe('mastered');
    });

    it('shows a message when no word matches the filter', () => {
        window.SV.DataManager.vocabulary = [word('fresh', { nextReview: null })];
        AppMain.setWordListFilter('mastered');

        expect(document.getElementById('wordList').textContent).toContain('No words match this filter');
        expect(document.querySelectorAll('.word-filter')).toHaveLength(4);
    });

    it('shows the empty state without chips for an empty vocabulary', () => {
        window.SV.DataManager.vocabulary = [];
        AppMain.renderWordList();

        expect(document.getElementById('wordCount').textContent).toBe('0');
        expect(document.getElementById('wordFilters').innerHTML).toBe('');
        expect(document.getElementById('wordList').textContent).toContain('No words yet!');
    });
});
