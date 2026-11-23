import { describe, it, expect, beforeEach } from 'vitest';

const { createToday } = require('../../js/today-view.js');

const NOW = new Date(2026, 10, 22, 10, 0);
const day = (daysAgo, hour = 9) => new Date(2026, 10, 22 - daysAgo, hour).toISOString();
const answer = (daysAgo, difficulty) => ({ date: day(daysAgo), difficulty });
const FUTURE = new Date(2026, 11, 30).toISOString();
const PAST = new Date(2026, 10, 1).toISOString();

const word = (original, nextReview, ...answers) => ({ id: original, original, translation: `${original}-tr`, nextReview, reviewHistory: answers });

describe('Today screen', () => {
    let vocabulary;
    let sessionSize;
    let today;
    const byTestId = (testId) => document.querySelector(`[data-testid="${testId}"]`);
    const text = (testId) => byTestId(testId).textContent.replace(/\s+/g, ' ').trim();

    beforeEach(() => {
        document.body.innerHTML = '<div id="today-tab"><div id="todayView"></div><div id="learningContent" hidden></div></div>';
        sessionSize = 15;
        vocabulary = [
            word('mastered', FUTURE, answer(2, 'easy'), answer(1, 'perfect'), answer(0, 'easy')),
            word('wobbly', PAST, answer(3, 'medium'), answer(2, 'easy')),
            word('tricky', PAST, answer(1, 'hard')),
            word('fresh', null),
            word('another', null)
        ];
        today = createToday({ getVocabulary: () => vocabulary, getSessionSize: () => sessionSize, getNow: () => NOW, document });
    });

    it('shows the title, the local date and the day streak', () => {
        today.update();

        expect(text('today-date')).toBe('Sunday 22 November');
        expect(text('today-streak')).toBe('4-day streak');
        expect(document.querySelector('#todayView h3').textContent).toBe('Today');
    });

    it('counts the due words and splits them into reviews and new', () => {
        today.update();

        expect(text('today-due')).toBe('4 words');
        expect(text('today-breakdown')).toBe('2 reviews · 2 new · about 1 min');
    });

    it('estimates the minutes of the session that will run, not of all due words', () => {
        vocabulary = Array.from({ length: 40 }, (_, i) => word(`w${i}`, null));
        sessionSize = 10;
        today.update();
        expect(text('today-breakdown')).toBe('0 reviews · 40 new · about 3 min');

        sessionSize = 20;
        today.update();
        expect(text('today-breakdown')).toBe('0 reviews · 40 new · about 5 min');
    });

    it('uses singular nouns for one word', () => {
        vocabulary = [word('only', PAST, answer(1, 'easy'))];
        today.update();

        expect(text('today-due')).toBe('1 word');
        expect(text('today-breakdown')).toBe('1 review · 0 new · about 1 min');
        expect(text('today-total')).toBe('1 word');
    });

    it('starts the session through the start-learning action', () => {
        today.update();

        expect(byTestId('start-session-btn').getAttribute('data-action')).toBe('start-learning');
    });

    it('shows the vocabulary total and the four status buckets', () => {
        today.update();

        expect(text('today-total')).toBe('5 words');
        expect(text('today-bucket-mastered')).toBe('1 Mastered');
        expect(text('today-bucket-learning')).toBe('1 Learning');
        expect(text('today-bucket-difficult')).toBe('1 Difficult');
        expect(text('today-bucket-new')).toBe('2 New');
    });

    it('sizes the bar segments by the bucket counts and leaves out empty buckets', () => {
        vocabulary = [word('a', null), word('b', null), word('c', null, answer(1, 'easy'))];
        today.update();

        const segments = [...document.querySelectorAll('.vocab-bar__segment')];
        expect(segments.map(segment => segment.style.flexGrow)).toEqual(['1', '2']);
    });

    it('lists the tricky words with their share of right answers', () => {
        today.update();

        const rows = [...document.querySelectorAll('[data-testid="tricky-word"]')].map(row => row.textContent.replace(/\s+/g, ' ').trim());
        expect(rows).toEqual(['tricky tricky-tr 0% right', 'wobbly wobbly-tr 75% right']);
    });

    it('offers the Difficult filter behind See all', () => {
        today.update();

        const link = byTestId('tricky-see-all');
        expect(link.getAttribute('data-action')).toBe('show-words');
        expect(link.getAttribute('data-arg')).toBe('difficult');
    });

    it('hides tricky words while no word has an answer', () => {
        vocabulary = [word('fresh', null)];
        today.update();

        expect(byTestId('today-tricky')).toBeNull();
    });

    it('hides the whole section when only mastered words have answers', () => {
        vocabulary = [word('sure', FUTURE, answer(1, 'easy'), answer(0, 'perfect')), word('fresh', null)];
        today.update();

        expect(byTestId('today-tricky')).toBeNull();
        expect(byTestId('tricky-see-all')).toBeNull();
    });

    it('escapes words in the tricky list', () => {
        vocabulary = [word('<b>bold</b>', PAST, answer(1, 'hard'))];
        today.update();

        expect(byTestId('tricky-word').querySelector('b')).toBeNull();
        expect(byTestId('tricky-word').textContent).toContain('<b>bold</b>');
    });

    describe('when nothing is due', () => {
        beforeEach(() => {
            vocabulary = [word('later', new Date(2026, 10, 22, 18, 30).toISOString(), answer(0, 'easy'))];
        });

        it('shows the calm empty state with the next review time instead of the review card', () => {
            today.update();

            expect(byTestId('today-review')).toBeNull();
            expect(text('today-empty')).toContain('No words need review right now');
            expect(text('today-next-review')).toBe('Today, 18:30');
            expect(byTestId('today-empty').querySelector('[data-action="force-start-learning"]')).toBeTruthy();
        });

        it('names the day of a later review', () => {
            vocabulary[0].nextReview = new Date(2026, 10, 23, 9).toISOString();
            today.update();

            expect(text('today-next-review')).toBe('Tomorrow');
        });

        it('keeps the vocabulary card', () => {
            today.update();

            expect(text('today-total')).toBe('1 word');
        });
    });

    describe('without words', () => {
        beforeEach(() => {
            vocabulary = [];
            today.update();
        });

        it('asks to add words and has no next review', () => {
            expect(text('today-empty')).toContain('Add some words first');
            expect(byTestId('today-next-review')).toBeNull();
        });

        it('shows neither vocabulary nor tricky words', () => {
            expect(byTestId('today-vocabulary')).toBeNull();
            expect(byTestId('today-tricky')).toBeNull();
        });
    });

    describe('overview and session views', () => {
        const overview = () => document.getElementById('todayView');
        const session = () => document.getElementById('learningContent');

        it('swaps the overview for the session and back', () => {
            today.showSession();
            expect(overview().hidden).toBe(true);
            expect(session().hidden).toBe(false);

            today.showOverview();
            expect(overview().hidden).toBe(false);
            expect(session().hidden).toBe(true);
        });

        it('refreshes the numbers when the overview returns', () => {
            today.showOverview();
            expect(text('today-due')).toBe('4 words');

            vocabulary.forEach(w => { w.nextReview = FUTURE; });
            today.showSession();
            today.showOverview();

            expect(byTestId('today-due')).toBeNull();
            expect(text('today-empty')).toContain('No words need review right now');
        });
    });

    it('does not throw without the screen in the page', () => {
        document.body.innerHTML = '';

        expect(() => today.showOverview()).not.toThrow();
        expect(() => today.showSession()).not.toThrow();
    });
});
