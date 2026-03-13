const { validateSfId, escapeString, escapeLike, validateDate, validateEnum } = require('../src/utils/soqlSanitizer');

describe('validateSfId', () => {
  test('accepts valid 15-char ID', () => {
    expect(validateSfId('001000000000001')).toBe('001000000000001');
  });

  test('accepts valid 18-char ID', () => {
    expect(validateSfId('001000000000001AAA')).toBe('001000000000001AAA');
  });

  test('rejects SQL injection in ID', () => {
    expect(() => validateSfId("'; DROP TABLE--")).toThrow('Invalid Salesforce ID');
  });

  test('rejects too-short ID', () => {
    expect(() => validateSfId('abc')).toThrow('Invalid Salesforce ID');
  });

  test('rejects null/undefined', () => {
    expect(() => validateSfId(null)).toThrow('is required');
    expect(() => validateSfId(undefined)).toThrow('is required');
  });

  test('rejects IDs with special characters', () => {
    expect(() => validateSfId('001000000000!@#')).toThrow('Invalid Salesforce ID');
  });

  test('sets statusCode 400 on error', () => {
    try {
      validateSfId('bad');
    } catch (e) {
      expect(e.statusCode).toBe(400);
    }
  });
});

describe('escapeString', () => {
  test('escapes single quotes', () => {
    expect(escapeString("it's")).toBe("it\\'s");
  });

  test('escapes backslashes', () => {
    expect(escapeString('a\\b')).toBe('a\\\\b');
  });

  test('strips null bytes', () => {
    expect(escapeString('a\0b')).toBe('ab');
  });

  test('handles null/undefined', () => {
    expect(escapeString(null)).toBe('');
    expect(escapeString(undefined)).toBe('');
  });

  test('handles numbers', () => {
    expect(escapeString(42)).toBe('42');
  });

  test('prevents SOQL injection via string', () => {
    const malicious = "' OR '1'='1";
    const escaped = escapeString(malicious);
    // All single quotes must be escaped with backslash
    expect(escaped).not.toMatch(/(?<!\\)'/);
    expect(escaped).toBe("\\' OR \\'1\\'=\\'1");
  });
});

describe('escapeLike', () => {
  test('escapes %', () => {
    expect(escapeLike('100%')).toBe('100\\%');
  });

  test('escapes _', () => {
    expect(escapeLike('a_b')).toBe('a\\_b');
  });

  test('escapes quotes and backslashes', () => {
    expect(escapeLike("it's\\here")).toBe("it\\'s\\\\here");
  });

  test('handles null', () => {
    expect(escapeLike(null)).toBe('');
  });
});

describe('validateDate', () => {
  test('accepts valid date', () => {
    expect(validateDate('2024-01-15')).toBe('2024-01-15');
  });

  test('rejects bad format', () => {
    expect(() => validateDate('01/15/2024')).toThrow('Invalid date format');
  });

  test('rejects injection', () => {
    expect(() => validateDate("2024-01-01' OR '1'='1")).toThrow('Invalid date format');
  });

  test('rejects impossible date', () => {
    expect(() => validateDate('2024-13-45')).toThrow();
  });
});

describe('validateEnum', () => {
  const allowed = ['Ordered', 'Picked up', 'Canceled', 'Delivered'];

  test('accepts valid value', () => {
    expect(validateEnum('Ordered', allowed)).toBe('Ordered');
  });

  test('rejects invalid value', () => {
    expect(() => validateEnum('Hacked', allowed)).toThrow('Invalid');
  });

  test('rejects injection attempt', () => {
    expect(() => validateEnum("Ordered' OR '1'='1", allowed)).toThrow('Invalid');
  });
});
