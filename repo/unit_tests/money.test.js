const { addCents, subtractCents, multiplyRate, varianceCheck, calculateTimeEntryCents, calculatePieceRateCents, formatCentsToUSD } = require('/app/dist/utils/money');

describe('Money Utils', () => {
  test('addCents adds two cent values', () => {
    expect(addCents(100, 200)).toBe(300);
    expect(addCents(0, 0)).toBe(0);
    expect(addCents(-100, 50)).toBe(-50);
  });

  test('subtractCents subtracts cent values', () => {
    expect(subtractCents(300, 100)).toBe(200);
    expect(subtractCents(0, 100)).toBe(-100);
  });

  test('multiplyRate multiplies cents by multiplier', () => {
    expect(multiplyRate(1000, 2)).toBe(2000);
    expect(multiplyRate(333, 3)).toBe(999);
  });

  test('calculateTimeEntryCents computes hourly rate for minutes', () => {
    expect(calculateTimeEntryCents(6000, 60)).toBe(6000); // $60/hr * 1hr
    expect(calculateTimeEntryCents(6000, 30)).toBe(3000); // $60/hr * 0.5hr
    expect(calculateTimeEntryCents(6000, 15)).toBe(1500); // $60/hr * 0.25hr
  });

  test('calculatePieceRateCents computes quantity * unit rate', () => {
    expect(calculatePieceRateCents(500, 10)).toBe(5000);
    expect(calculatePieceRateCents(0, 10)).toBe(0);
  });

  test('formatCentsToUSD formats correctly', () => {
    expect(formatCentsToUSD(12345)).toBe('$123.45');
    expect(formatCentsToUSD(0)).toBe('$0.00');
    expect(formatCentsToUSD(-500)).toBe('-$5.00');
    expect(formatCentsToUSD(1)).toBe('$0.01');
  });

  describe('varianceCheck - corrected threshold logic', () => {
    test('no variance returns requiresReason=false', () => {
      const result = varianceCheck(10000, 10000);
      expect(result.requiresReason).toBe(false);
      expect(result.varianceAmountCents).toBe(0);
    });

    test('threshold uses max(2% of subtotal, $25)', () => {
      // subtotal=$1000 → 2%=$20, $25 is greater → threshold=$25
      const r1 = varianceCheck(100000, 102400); // diff=$24, below $25 threshold
      expect(r1.requiresReason).toBe(false);

      const r2 = varianceCheck(100000, 102600); // diff=$26, above $25 threshold
      expect(r2.requiresReason).toBe(true);
    });

    test('when 2% > $25, uses 2% as threshold', () => {
      // subtotal=$2000 → 2%=$40, which is > $25 → threshold=$40
      const r1 = varianceCheck(200000, 203900); // diff=$39, below $40 threshold
      expect(r1.requiresReason).toBe(false);

      const r2 = varianceCheck(200000, 204100); // diff=$41, above $40 threshold
      expect(r2.requiresReason).toBe(true);
    });

    test('exact boundary: diff equals threshold', () => {
      // subtotal=$1250 → 2%=$25 = threshold → diff must be > threshold
      const result = varianceCheck(125000, 127500); // diff exactly $25
      expect(result.requiresReason).toBe(false); // not > threshold, equal
    });

    test('zero subtotal uses $25 threshold', () => {
      const r1 = varianceCheck(0, 2400); // diff=$24
      expect(r1.requiresReason).toBe(false);

      const r2 = varianceCheck(0, 2600); // diff=$26
      expect(r2.requiresReason).toBe(true);
    });
  });
});
