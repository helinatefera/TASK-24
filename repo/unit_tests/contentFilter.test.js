const { scanText } = require('/app/dist/middleware/contentFilter');

describe('Content Filter', () => {
  test('clean text returns isClean=true', () => {
    const result = scanText('This is a normal message');
    expect(result.isClean).toBe(true);
    expect(result.matchedWords).toHaveLength(0);
  });

  test('empty text returns isClean=true', () => {
    const result = scanText('');
    expect(result.isClean).toBe(true);
  });

  test('null text returns isClean=true', () => {
    const result = scanText(null);
    expect(result.isClean).toBe(true);
  });

  test('returns empty matchedWords when word set is empty', () => {
    const result = scanText('any text here');
    expect(result.isClean).toBe(true);
    expect(result.matchedWords).toEqual([]);
  });
});
