import { describe, it, expect, beforeEach, vi } from 'vitest';

const json = (body, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });

const DICTIONARY_ENTRY = [{
  word: 'forthright',
  phonetics: [{ text: '/ˈfɔːθˌɹaɪt/' }],
  meanings: [
    { partOfSpeech: 'noun', definitions: [{ definition: 'A straight path.', example: 'down the forthright' }], synonyms: ['straightforward'] }
  ]
}];

function routedFetch(routes) {
  return vi.fn((url) => {
    const route = Object.keys(routes).find(host => url.includes(host));
    return route ? routes[route](url) : Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe('DictionaryService.lookupWord', () => {
  let createDictionaryService;
  let warn;

  beforeEach(() => {
    createDictionaryService = require('../../js/dictionary-service.js').createDictionaryService;
    warn = vi.fn();
  });

  const lookup = (fetch, word) => createDictionaryService({ fetch, warn }).lookupWord(word);

  it('uses the common Datamuse sense instead of the rare first dictionary sense', async () => {
    const fetch = routedFetch({
      'dictionaryapi.dev': () => json(DICTIONARY_ENTRY),
      'datamuse.com': () => json([{ word: 'forthright', defs: ['adj\tStraightforward; not evasive; candid.'] }])
    });
    const result = await lookup(fetch, 'Forthright ');

    expect(result.definition).toBe('Straightforward; not evasive; candid.');
    expect(result.phonetic).toBe('/ˈfɔːθˌɹaɪt/');
    expect(result.examples[0].text).toBe('down the forthright');
    expect(result.synonyms).toEqual(['straightforward']);
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('wiktionary'));
  });

  it('fills a missing transcription from Wiktionary IPA', async () => {
    const fetch = routedFetch({
      'dictionaryapi.dev': () => json([{ word: 'understatement', phonetics: [{ audio: 'x.mp3' }], meanings: [] }]),
      'datamuse.com': () => json([{ word: 'understatement', defs: ['n\tA statement that is less than the truth.'] }]),
      'wiktionary.org': () => json({ parse: { wikitext: '===Pronunciation===\n* {{IPA|en|/ˌʌndəˈsteɪtmənt/|a=RP}}\n* {{IPA|en|/ˌʌndɚˈsteɪtmənt/|a=GA}}' } })
    });
    const result = await lookup(fetch, 'understatement');

    expect(result.phonetic).toBe('/ˌʌndəˈsteɪtmənt/');
    expect(result.definition).toBe('A statement that is less than the truth.');
  });

  it('encodes phrases in every request', async () => {
    const fetch = routedFetch({
      'dictionaryapi.dev': () => json({ title: 'No Definitions Found' }, false, 404),
      'datamuse.com': () => json([{ word: 'break the ice', defs: ['v\t(idiomatic) To start to get to know people.'] }]),
      'wiktionary.org': () => json({ parse: { wikitext: '{{IPA|en|/ˈbɹeɪk ði ˈaɪs/|a=US,UK}}' } })
    });
    const result = await lookup(fetch, 'break the ice');

    fetch.mock.calls.forEach(([url]) => expect(url).toContain('break%20the%20ice'));
    expect(result.phonetic).toBe('/ˈbɹeɪk ði ˈaɪs/');
    expect(result.definition).toBe('(idiomatic) To start to get to know people.');
  });

  it('ignores a Datamuse suggestion for a different word', async () => {
    const fetch = routedFetch({
      'dictionaryapi.dev': () => json(DICTIONARY_ENTRY),
      'datamuse.com': () => json([{ word: 'forthrightly', defs: ['adv\tIn a forthright manner.'] }])
    });
    const result = await lookup(fetch, 'forthright');

    expect(result.definition).toBe('A straight path.');
  });

  it('returns empty fields instead of made-up text when every source fails', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const result = await lookup(fetch, 'zzqx');

    expect(result).toMatchObject({ word: 'zzqx', phonetic: '', definition: '', examples: [], synonyms: [], source: 'fallback' });
    expect(warn).toHaveBeenCalledWith('Dictionary API failed:', 'offline');
    expect(warn).toHaveBeenCalledWith('Datamuse API failed:', 'offline');
    expect(warn).toHaveBeenCalledWith('Wiktionary API failed:', 'offline');
  });

  it('handles a Wiktionary page without English IPA', async () => {
    const fetch = routedFetch({
      'dictionaryapi.dev': () => json({}, false, 404),
      'datamuse.com': () => json([]),
      'wiktionary.org': () => json({ error: { code: 'missingtitle' } })
    });
    const result = await lookup(fetch, 'qwzx');

    expect(result.phonetic).toBe('');
    expect(result.definition).toBe('');
  });
});
