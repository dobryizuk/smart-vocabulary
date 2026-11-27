import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToDOM } from './test-helpers.js';

// A word's fields are typed by the user or come from dictionaries: they must show as text, never as markup
require('../../js/app-state.js');
const UI = require('../../js/ui-components.js');
const Recognition = require('../../js/exercises/recognition.js');
const Writing = require('../../js/exercises/writing.js');
const Build = require('../../js/exercises/build.js');
const Screen = require('../../js/exercises/exercise-screen.js');

const MARKUP = '<b>x</b>';
const AMPERSAND = 'a & b';
const QUOTED = '"q"';
// Every kind of character the escaping must keep, including text that looks like an entity
const TRICKY_ARG = `<b>x</b> & "q" 'q' &amp;`;

const trickyWord = (overrides = {}) => ({
    id: 'w"1&',
    original: MARKUP,
    translation: AMPERSAND,
    definition: QUOTED,
    phonetic: '<u>p</u>',
    examples: [`<i>e</i> & ${QUOTED}`],
    synonyms: [MARKUP, AMPERSAND],
    repetition: 0,
    easeFactor: 2.5,
    reviewHistory: [],
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides
});

const text = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const noMarkup = (element) => expect(element.querySelector('b, i, u')).toBeNull();

function startExercise(word) {
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.AppState.sessionTotal = 1;
}

beforeEach(() => {
    document.body.innerHTML = '<div id="learningContent"></div>';
    window.SV = window.SV || {};
    window.SV.UIComponents = UI;
});

describe('User text in the Words card', () => {
    const renderCard = () => renderToDOM(UI.createWordCard(trickyWord(), 'compact', [], true));

    it('shows the original, phonetic and translation of a collapsed row as text', () => {
        const card = renderCard();

        expect(text(card.querySelector('.word-card__original'))).toBe(`${MARKUP} <u>p</u>`);
        expect(text(card.querySelector('.word-card__phonetic'))).toBe('<u>p</u>');
        expect(text(card.querySelector('.word-card__translation'))).toBe(AMPERSAND);
        noMarkup(card);
    });

    it('shows the details of an expanded row as text', () => {
        const card = renderCard();
        card.querySelector('.word-card').classList.add('word-card--expanded');

        expect(text(card.querySelector('[data-testid="detail-definition"] .detail-text'))).toBe(QUOTED);
        expect(text(card.querySelector('[data-testid="detail-examples"] .detail-text'))).toBe(`• <i>e</i> & ${QUOTED}`);
        expect([...card.querySelectorAll('.synonym-chip')].map(text)).toEqual([MARKUP, AMPERSAND]);
        noMarkup(card);
    });

    it('keeps the card id and its toggle target equal to the word id', () => {
        const card = renderCard();

        expect(card.querySelector('.word-card').id).toBe('word-card-w"1&');
        expect(card.querySelector('.word-card__toggle').dataset.targetId).toBe('word-card-w"1&');
    });

    it('shows the definition and examples of a non-expandable card as text', () => {
        const card = renderToDOM(UI.createWordCard(trickyWord(), 'default', [], false));

        expect(text(card.querySelector('.word-card__definition'))).toBe(QUOTED);
        expect(text(card.querySelector('.word-card__examples'))).toBe(`<i>e</i> & ${QUOTED}`);
        noMarkup(card);
    });
});

describe('User text in the detail blocks', () => {
    it('shows definition, examples and synonyms as text in list and learning styles', () => {
        for (const variant of ['default', 'learning']) {
            const blocks = renderToDOM(UI.createWordDetailSections(trickyWord(), variant));

            expect(text(blocks.querySelector('[data-testid="detail-definition"] .detail-text'))).toBe(QUOTED);
            expect(text(blocks.querySelector('[data-testid="detail-examples"]'))).toContain(`<i>e</i> & ${QUOTED}`);
            expect([...blocks.querySelectorAll('.synonym-chip')].map(text)).toEqual([MARKUP, AMPERSAND]);
            noMarkup(blocks);
        }
    });
});

describe('User text in the exercises', () => {
    const answer = () => document.querySelector('.card-translation .detail-text');

    it('shows the word of the recognition card as text', () => {
        startExercise(trickyWord());
        Recognition.showRecognitionCard();

        const card = document.querySelector('.word-card');
        expect(text(card.querySelector('.word-card__original'))).toBe(`${MARKUP} <u>p</u>`);
        noMarkup(card);
    });

    it('shows the recognition answer as text, escaped once', () => {
        startExercise(trickyWord({ definition: '' }));
        Recognition.showRecognitionCard();
        Recognition.showTranslation();

        expect(answer().textContent).toBe(AMPERSAND);
    });

    it('shows the writing prompt and its correct answer as text, escaped once', () => {
        startExercise(trickyWord({ original: `${AMPERSAND} ${QUOTED}` }));
        Writing.showReverseTranslationCard();
        expect(text(document.querySelector('.exercise-card__title'))).toBe(AMPERSAND);
        expect(text(document.querySelector('.exercise-card__definition'))).toBe(QUOTED);

        Writing.checkReverseTranslation();

        expect(answer().textContent).toBe(`${AMPERSAND} ${QUOTED}`);
    });

    it('shows the build prompt and its correct answer as text, escaped once', () => {
        startExercise(trickyWord({ original: `${MARKUP} ${AMPERSAND}` }));
        Build.showBuildCard();
        expect(text(document.querySelector('.exercise-card__title'))).toBe(AMPERSAND);

        Screen.revealCorrectAnswer('hard');

        expect(answer().textContent).toBe(`${MARKUP} ${AMPERSAND}`);
        noMarkup(answer());
    });

    it('gives the speaker button of an answer the exact word', () => {
        startExercise(trickyWord({ original: TRICKY_ARG }));
        Screen.revealCorrectAnswer('hard');

        expect(document.querySelector('.card-translation [data-action="speak-word"]').getAttribute('data-arg')).toBe(TRICKY_ARG);
    });
});

describe('User text in the delete confirmation', () => {
    it('names the word as text', () => {
        document.body.innerHTML = '';
        UI.showDeleteConfirmation(trickyWord({ original: `${MARKUP} ${AMPERSAND} ${QUOTED}` }), vi.fn(), { document });

        const name = document.querySelector('.confirm-dialog__text strong');
        expect(name.textContent).toBe(`${MARKUP} ${AMPERSAND} ${QUOTED}`);
        noMarkup(name);
    });
});

describe('Arguments of action buttons', () => {
    it('reach the action as the exact original string', () => {
        const card = renderToDOM(UI.createWordCard(trickyWord(), 'compact', [UI.createSpeakAction(TRICKY_ARG)], true));

        expect(card.querySelector('[data-action="speak-word"]').getAttribute('data-arg')).toBe(TRICKY_ARG);
    });

    it('reach the action as the exact original string from a plain button', () => {
        const button = renderToDOM(UI.createButton('Go', 'go', 'primary', false, '', '', '', '', TRICKY_ARG));

        expect(button.querySelector('[data-action="go"]').getAttribute('data-arg')).toBe(TRICKY_ARG);
    });

    it('add no data-arg when there is no argument', () => {
        const button = renderToDOM(UI.createButton('Go', 'go'));

        expect(button.querySelector('button').hasAttribute('data-arg')).toBe(false);
    });
});

describe('escapeHtml', () => {
    it('escapes every character that could open markup or close an attribute', () => {
        expect(UI.escapeHtml(TRICKY_ARG)).not.toMatch(/[<>"']|&(?!#\d+;)/);
    });

    it('turns a missing value into empty text', () => {
        expect(UI.escapeHtml(undefined)).toBe('');
        expect(UI.escapeHtml(null)).toBe('');
    });
});
