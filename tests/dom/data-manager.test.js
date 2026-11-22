import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const { createDataManager } = require('../../js/data-manager.js');

const words = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'test-vocabulary.json'), 'utf8')
).vocabulary.slice(0, 3);

function createMemoryStorage(initial) {
  const data = { ...initial };
  return {
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => { data[key] = value; }),
    removeItem: vi.fn((key) => { delete data[key]; })
  };
}

describe('DataManager.initializeVocabulary', () => {
  const fixedNow = new Date('2030-01-02T03:04:05.000Z');

  it('merges userProgress over stored words, defaults for the rest, and writes nothing', async () => {
    const progress = {
      repetition: 4,
      easeFactor: 2.1,
      nextReview: '2031-01-01T00:00:00.000Z',
      reviewHistory: [{ success: true }]
    };
    const storage = createMemoryStorage({
      allVocabulary: JSON.stringify(words),
      userProgress: JSON.stringify({ [words[0].id]: progress })
    });
    const manager = createDataManager({ storage, now: () => fixedNow });

    await manager.initializeVocabulary();

    expect(manager.vocabulary).toHaveLength(words.length);
    expect(manager.vocabulary[0]).toMatchObject({ id: words[0].id, original: words[0].original, ...progress });
    for (const word of manager.vocabulary.slice(1)) {
      expect(word).toMatchObject({ repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] });
    }
    expect(manager.vocabulary[1].createdAt).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('fills missing createdAt and addedDate from the current time', async () => {
    const { id, original, translation } = words[0];
    const storage = createMemoryStorage({ allVocabulary: JSON.stringify([{ id, original, translation }]) });
    const manager = createDataManager({ storage, now: () => fixedNow });

    await manager.initializeVocabulary();

    expect(manager.vocabulary[0].createdAt).toBe(fixedNow.toISOString());
    expect(manager.vocabulary[0].addedDate).toBe(fixedNow.toISOString());
  });

  it('results in an empty vocabulary when storage is empty or corrupt', async () => {
    const empty = createDataManager({ storage: createMemoryStorage({}) });
    await empty.initializeVocabulary();
    expect(empty.vocabulary).toEqual([]);

    const corrupt = createDataManager({ storage: createMemoryStorage({ allVocabulary: '{broken' }) });
    await corrupt.initializeVocabulary();
    expect(corrupt.vocabulary).toEqual([]);
  });
});
