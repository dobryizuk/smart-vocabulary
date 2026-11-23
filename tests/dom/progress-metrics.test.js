import { describe, it, expect } from 'vitest';

const {
    getDayStreaks, getWeeklyCounts, getStatusCounts, countDue,
    getReviewBreakdown, getNextReviewDate, estimateSessionMinutes, getTrickyWords
} = require('../../js/progress-metrics.js');

// Local calendar moments, so the tests hold in any time zone
const at = (month, day, hour = 12, minute = 0) => new Date(2026, month - 1, day, hour, minute);
const NOW = at(11, 20, 10);

const answered = (...dates) => ({ reviewHistory: dates.map(date => ({ date: date.toISOString(), difficulty: 'easy' })) });
const history = (...difficulties) => ({ reviewHistory: difficulties.map(difficulty => ({ difficulty })) });

describe('getDayStreaks', () => {
    it('is zero without any answer', () => {
        expect(getDayStreaks([], NOW)).toEqual({ current: 0, best: 0 });
        expect(getDayStreaks([{ reviewHistory: [] }, {}], NOW)).toEqual({ current: 0, best: 0 });
    });

    it('counts consecutive days ending today', () => {
        const words = [answered(at(11, 18), at(11, 19), at(11, 20, 8))];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 3, best: 3 });
    });

    it('keeps the streak alive when today has no answer yet but yesterday has', () => {
        const words = [answered(at(11, 18), at(11, 19))];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 2, best: 2 });
    });

    it('drops the current streak after a missed day but remembers the best one', () => {
        const words = [answered(at(11, 10), at(11, 11), at(11, 12), at(11, 13), at(11, 18))];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 0, best: 4 });
    });

    it('restarts after a gap', () => {
        const words = [answered(at(11, 14), at(11, 15), at(11, 17), at(11, 18), at(11, 19), at(11, 20))];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 4, best: 4 });
    });

    it('counts several answers on one day, from several words, once', () => {
        const words = [answered(at(11, 19, 8), at(11, 19, 9), at(11, 19, 23, 59)), answered(at(11, 19, 12), at(11, 20, 7))];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 2, best: 2 });
    });

    it('treats late night and early morning as different days', () => {
        const words = [answered(at(11, 19, 23, 59), at(11, 20, 0, 1))];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 2, best: 2 });
    });

    it('does not break across a month and a year boundary', () => {
        const words = [answered(new Date(2025, 11, 30), new Date(2025, 11, 31), new Date(2026, 0, 1))];
        expect(getDayStreaks(words, new Date(2026, 0, 1, 9))).toEqual({ current: 3, best: 3 });
    });

    it('does not break across the clock changes of daylight saving time', () => {
        const days = [];
        for (let day = 1; day <= 40; day++) days.push(new Date(2026, 2, day, 0, 30));
        const now = new Date(2026, 3, 9, 23, 30);
        expect(getDayStreaks([answered(...days)], now)).toEqual({ current: 40, best: 40 });
    });

    it('ignores answers dated in the future and entries without a valid date', () => {
        const words = [{ reviewHistory: [
            { date: at(11, 25).toISOString() },
            { date: 'not a date' },
            { date: null },
            { difficulty: 'easy' },
            null,
            { date: at(11, 20).toISOString() }
        ] }];
        expect(getDayStreaks(words, NOW)).toEqual({ current: 1, best: 1 });
    });
});

describe('getWeeklyCounts', () => {
    it('lists seven days, oldest first and today last', () => {
        const week = getWeeklyCounts([], NOW);

        expect(week).toHaveLength(7);
        expect(week.map(day => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6].map(offset => (NOW.getDay() + 1 + offset) % 7));
        expect(week.map(day => day.isToday)).toEqual([false, false, false, false, false, false, true]);
        expect(week.every(day => day.count === 0)).toBe(true);
    });

    it('counts every answer of a day, across words', () => {
        const words = [answered(at(11, 20, 1), at(11, 20, 9), at(11, 19)), answered(at(11, 20, 7), at(11, 14))];

        expect(getWeeklyCounts(words, NOW).map(day => day.count)).toEqual([1, 0, 0, 0, 0, 1, 3]);
    });

    it('leaves out answers older than seven days and in the future', () => {
        const words = [answered(at(11, 14), at(11, 13), at(11, 12), at(11, 21))];

        expect(getWeeklyCounts(words, NOW).map(day => day.count)).toEqual([1, 0, 0, 0, 0, 0, 0]);
    });
});

describe('getStatusCounts', () => {
    it('buckets every word by its answer-based status', () => {
        const words = [
            history('easy', 'perfect', 'easy'),
            history('hard', 'easy', 'hard'),
            history('medium', 'easy'),
            history('hard'),
            {},
            { reviewHistory: [] }
        ];

        expect(getStatusCounts(words)).toEqual({ mastered: 1, learning: 1, difficult: 2, new: 2 });
    });

    it('lists all four statuses for an empty vocabulary', () => {
        expect(getStatusCounts([])).toEqual({ mastered: 0, learning: 0, difficult: 0, new: 0 });
    });
});

describe('countDue', () => {
    it('counts new words and words whose review date has come', () => {
        const words = [
            { nextReview: null },
            { nextReview: at(11, 19).toISOString() },
            { nextReview: NOW.toISOString() },
            { nextReview: at(11, 21).toISOString() }
        ];

        expect(countDue(words, NOW)).toBe(3);
    });
});

describe('getReviewBreakdown', () => {
    const due = (...difficulties) => ({ nextReview: null, ...history(...difficulties) });

    it('splits the due words into reviews, which have history, and new ones', () => {
        const words = [
            due('easy'),
            { nextReview: at(11, 19).toISOString(), ...history('hard', 'easy') },
            due(),
            { nextReview: null },
            { nextReview: at(11, 25).toISOString(), ...history('easy') }
        ];

        expect(getReviewBreakdown(words, NOW)).toEqual({ reviews: 2, fresh: 2 });
    });

    it('is empty when nothing is due', () => {
        expect(getReviewBreakdown([], NOW)).toEqual({ reviews: 0, fresh: 0 });
        expect(getReviewBreakdown([{ nextReview: at(11, 25).toISOString() }], NOW)).toEqual({ reviews: 0, fresh: 0 });
    });

    it('agrees with countDue', () => {
        const words = [due('easy'), due(), { nextReview: at(11, 25).toISOString() }];
        const { reviews, fresh } = getReviewBreakdown(words, NOW);

        expect(reviews + fresh).toBe(countDue(words, NOW));
    });
});

describe('estimateSessionMinutes', () => {
    it('takes 15 seconds a word and rounds up to whole minutes', () => {
        expect(estimateSessionMinutes(1, 15)).toBe(1);
        expect(estimateSessionMinutes(4, 15)).toBe(1);
        expect(estimateSessionMinutes(5, 15)).toBe(2);
        expect(estimateSessionMinutes(15, 15)).toBe(4);
    });

    it('counts only the words the session will run', () => {
        expect(estimateSessionMinutes(200, 15)).toBe(4);
        expect(estimateSessionMinutes(200, 20)).toBe(5);
        expect(estimateSessionMinutes(12, 20)).toBe(3);
    });

    it('is zero when nothing is due', () => {
        expect(estimateSessionMinutes(0, 15)).toBe(0);
    });
});

describe('getNextReviewDate', () => {
    it('finds the soonest review still ahead', () => {
        const words = [
            { nextReview: at(11, 25).toISOString() },
            { nextReview: at(11, 22).toISOString() },
            { nextReview: at(11, 18).toISOString() },
            { nextReview: null }
        ];

        expect(getNextReviewDate(words, NOW)).toEqual(at(11, 22));
    });

    it('is null when nothing is scheduled ahead', () => {
        expect(getNextReviewDate([], NOW)).toBeNull();
        expect(getNextReviewDate([{ nextReview: null }, { nextReview: at(11, 18).toISOString() }], NOW)).toBeNull();
    });
});

describe('getTrickyWords', () => {
    const word = (original, ...difficulties) => ({ original, translation: `${original}-tr`, ...history(...difficulties) });

    it('orders words by the lowest share of right answers', () => {
        const tricky = getTrickyWords([
            word('fine', 'easy', 'medium'),
            word('worst', 'hard', 'hard'),
            word('half', 'medium', 'medium')
        ]);

        expect(tricky.map(item => [item.word.original, item.percentRight])).toEqual([['worst', 0], ['half', 50], ['fine', 75]]);
    });

    it('never lists a mastered word, even when fewer than three others qualify', () => {
        const tricky = getTrickyWords([
            word('perfect', 'easy', 'easy'),
            word('solid', 'easy', 'easy', 'easy', 'easy', 'hard'),
            word('shaky', 'hard')
        ]);

        expect(tricky.map(item => item.word.original)).toEqual(['shaky']);
    });

    it('is empty when every answered word is mastered', () => {
        expect(getTrickyWords([word('a', 'easy'), word('b', 'perfect', 'easy')])).toEqual([]);
    });

    it('scores like the word status: the last five answers, medium counts half', () => {
        const [item] = getTrickyWords([word('late', 'hard', 'hard', 'hard', 'easy', 'easy', 'easy', 'medium', 'hard')]);

        expect(item.percentRight).toBe(70);
        expect(item.status.key).toBe('learning');
    });

    it('ignores words without answers', () => {
        expect(getTrickyWords([{ original: 'fresh' }, { original: 'empty', reviewHistory: [] }])).toEqual([]);
    });

    it('returns fewer than three when fewer words have answers', () => {
        const tricky = getTrickyWords([word('a', 'hard'), { original: 'b' }]);

        expect(tricky).toHaveLength(1);
    });

    it('keeps the three lowest and breaks ties alphabetically', () => {
        const tricky = getTrickyWords([
            word('delta', 'hard'),
            word('bravo', 'hard'),
            word('alpha', 'hard'),
            word('charlie', 'hard'),
            word('echo', 'easy')
        ]);

        expect(tricky.map(item => item.word.original)).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('reports the status of each word', () => {
        const [low, mid] = getTrickyWords([word('low', 'hard'), word('mid', 'medium')]);

        expect(low.status.key).toBe('difficult');
        expect(mid.status.key).toBe('learning');
    });
});
