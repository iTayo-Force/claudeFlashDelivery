// Mock salesforce config to prevent process.exit from missing env vars
jest.mock('../src/config/salesforce', () => ({
  withConnection: jest.fn(),
}));
jest.mock('../src/config/env', () => ({
  jwt: { clientSecret: 'test', employeeSecret: 'test', accessExpiry: '1h', refreshExpiry: '7d' },
  salesforce: { loginUrl: '', username: '', password: '', securityToken: '' },
}));

const { VALID_STATUSES, STATUS_TRANSITIONS } = require('../src/services/deliveryService');
const { validateSfId, validateEnum } = require('../src/utils/soqlSanitizer');

describe('Delivery statuses', () => {
  test('has exactly 4 valid statuses', () => {
    expect(VALID_STATUSES).toEqual(['Ordered', 'Picked up', 'Canceled', 'Delivered']);
  });

  test('Ordered can transition to Picked up or Canceled', () => {
    expect(STATUS_TRANSITIONS['Ordered']).toEqual(['Picked up', 'Canceled']);
  });

  test('Picked up can transition to Delivered or Canceled', () => {
    expect(STATUS_TRANSITIONS['Picked up']).toEqual(['Delivered', 'Canceled']);
  });

  test('Delivered is a terminal state', () => {
    expect(STATUS_TRANSITIONS['Delivered']).toEqual([]);
  });

  test('Canceled is a terminal state', () => {
    expect(STATUS_TRANSITIONS['Canceled']).toEqual([]);
  });

  test('all valid statuses have transition entries', () => {
    VALID_STATUSES.forEach((status) => {
      expect(STATUS_TRANSITIONS).toHaveProperty(status);
    });
  });
});

describe('Delivery input validation', () => {
  test('rejects invalid sender ID', () => {
    expect(() => validateSfId("'; DROP TABLE--", 'senderId')).toThrow('Invalid Salesforce ID');
  });

  test('accepts valid 18-char sender ID', () => {
    expect(validateSfId('001000000000001AAA', 'senderId')).toBe('001000000000001AAA');
  });

  test('rejects invalid status via validateEnum', () => {
    expect(() => validateEnum('In Transit', VALID_STATUSES, 'status')).toThrow('Invalid');
  });

  test('accepts valid status via validateEnum', () => {
    expect(validateEnum('Ordered', VALID_STATUSES, 'status')).toBe('Ordered');
    expect(validateEnum('Picked up', VALID_STATUSES, 'status')).toBe('Picked up');
  });
});

describe('Status transition validation logic', () => {
  function canTransition(from, to) {
    const allowed = STATUS_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  test('Ordered -> Picked up is valid', () => {
    expect(canTransition('Ordered', 'Picked up')).toBe(true);
  });

  test('Ordered -> Delivered is invalid (must pick up first)', () => {
    expect(canTransition('Ordered', 'Delivered')).toBe(false);
  });

  test('Picked up -> Delivered is valid', () => {
    expect(canTransition('Picked up', 'Delivered')).toBe(true);
  });

  test('Delivered -> anything is invalid', () => {
    expect(canTransition('Delivered', 'Ordered')).toBe(false);
    expect(canTransition('Delivered', 'Canceled')).toBe(false);
  });

  test('Canceled -> anything is invalid', () => {
    expect(canTransition('Canceled', 'Ordered')).toBe(false);
    expect(canTransition('Canceled', 'Delivered')).toBe(false);
  });

  test('Ordered -> Canceled is valid', () => {
    expect(canTransition('Ordered', 'Canceled')).toBe(true);
  });

  test('Picked up -> Canceled is valid', () => {
    expect(canTransition('Picked up', 'Canceled')).toBe(true);
  });
});
