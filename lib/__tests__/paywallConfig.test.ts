import { describe, expect, test } from 'vitest';
import { CONTACT_EMAIL, PRIVACY_URL, TERMS_URL } from '../paywallConfig';

describe('paywall configuration', () => {
  test('does not use placeholder domains', () => {
    expect([TERMS_URL, PRIVACY_URL, CONTACT_EMAIL].join('\n')).not.toContain(['example', 'com'].join('.'));
  });
});
