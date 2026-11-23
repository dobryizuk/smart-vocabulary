// ============================================================================
// PROGRESS METRICS - day streaks, weekly answers and status buckets derived from the words
// ============================================================================

const SpacedRepetition = require('./spaced-repetition.js');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const SECONDS_PER_WORD = 15;
const SECONDS_PER_MINUTE = 60;
const TRICKY_WORD_LIMIT = 3;
const TRICKY_STATUSES = ['difficult', 'learning'];

// Counts calendar days of the local time zone, so a day is always exactly one step
function toDayNumber(value) {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY;
}

function answerDayNumbers(words) {
    const days = [];
    words.forEach(word => {
        (word.reviewHistory || []).forEach(answer => {
            const day = toDayNumber(answer?.date);
            if (day !== null) days.push(day);
        });
    });
    return days;
}

function longestRun(sortedDays) {
    let best = 0;
    let run = 0;
    sortedDays.forEach((day, index) => {
        run = index > 0 && day - sortedDays[index - 1] === 1 ? run + 1 : 1;
        best = Math.max(best, run);
    });
    return best;
}

function currentRun(daySet, today) {
    let day = daySet.has(today) ? today : today - 1;
    let run = 0;
    while (daySet.has(day)) {
        run++;
        day--;
    }
    return run;
}

// Streak days need at least one answer; today may still be open, so a run ending yesterday counts
function getDayStreaks(words, now = new Date()) {
    const today = toDayNumber(now);
    const days = [...new Set(answerDayNumbers(words))].filter(day => day <= today).sort((a, b) => a - b);
    return { current: currentRun(new Set(days), today), best: longestRun(days) };
}

// Answers per day for the last seven days, oldest first, today last
function getWeeklyCounts(words, now = new Date()) {
    const today = toDayNumber(now);
    const perDay = new Map();
    answerDayNumbers(words).forEach(day => perDay.set(day, (perDay.get(day) || 0) + 1));
    return Array.from({ length: WEEK_DAYS }, (_, index) => {
        const day = today - (WEEK_DAYS - 1 - index);
        return {
            weekday: new Date(day * MS_PER_DAY).getUTCDay(),
            count: perDay.get(day) || 0,
            isToday: day === today
        };
    });
}

function getStatusCounts(words) {
    const counts = Object.fromEntries(Object.keys(SpacedRepetition.STATUS_LABELS).map(key => [key, 0]));
    words.forEach(word => { counts[SpacedRepetition.getWordStatus(word).key]++; });
    return counts;
}

function countDue(words, now = new Date()) {
    return words.filter(word => SpacedRepetition.isDue(word, now)).length;
}

// Due words that were answered before are reviews, the rest are new
function getReviewBreakdown(words, now = new Date()) {
    const due = words.filter(word => SpacedRepetition.isDue(word, now));
    const reviews = due.filter(word => (word.reviewHistory || []).length > 0).length;
    return { reviews, fresh: due.length - reviews };
}

// The soonest review date still ahead, or null when nothing is scheduled
function getNextReviewDate(words, now = new Date()) {
    const upcoming = words
        .filter(word => word.nextReview && !SpacedRepetition.isDue(word, now))
        .map(word => new Date(word.nextReview));
    return upcoming.length > 0 ? new Date(Math.min(...upcoming)) : null;
}

// Whole minutes for the words a session will run: the due words, capped by the session size
function estimateSessionMinutes(dueCount, sessionSize) {
    return Math.ceil(Math.min(dueCount, sessionSize) * SECONDS_PER_WORD / SECONDS_PER_MINUTE);
}

// Words still being learned or struggled with, lowest recent share of right answers first
function getTrickyWords(words, limit = TRICKY_WORD_LIMIT) {
    return words
        .map(word => ({ word, score: SpacedRepetition.getRecentScore(word), status: SpacedRepetition.getWordStatus(word) }))
        .filter(({ status }) => TRICKY_STATUSES.includes(status.key))
        .sort((a, b) => a.score - b.score || a.word.original.localeCompare(b.word.original))
        .slice(0, limit)
        .map(({ word, score, status }) => ({ word, percentRight: Math.round(score * 100), status }));
}

module.exports = {
    getDayStreaks,
    getWeeklyCounts,
    getStatusCounts,
    countDue,
    getReviewBreakdown,
    getNextReviewDate,
    estimateSessionMinutes,
    getTrickyWords
};
