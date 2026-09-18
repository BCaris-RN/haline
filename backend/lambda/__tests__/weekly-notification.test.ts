import { afterEach, describe, expect, test, vi } from 'vitest';
import { calculateCFCBias } from '../../../lib/cfcBias';
import { getNOAAEndpoint } from '../../../lib/noaaData';
import { createWeeklyNotificationHandler, getNotificationIdempotencyKey } from '../weekly-notification';

const APP_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ENV = { ONESIGNAL_APP_ID: APP_ID, ONESIGNAL_API_KEY: 'test-only-app-api-key' };
const EVENT = {
  scheduleArn: 'arn:aws:scheduler:us-west-2:123456789012:schedule/default/haline-weekly',
  scheduledTime: '2026-09-21T09:00:00Z',
};
const DESCRIPTION = {
  title: 'Global Ocean Average Temperature Departures',
  units: 'Degrees Celsius',
  base_period: '1901-2000',
};

function noaaFixture(value = 1.08) {
  return {
    description: DESCRIPTION,
    // Deliberately out of order: the Lambda must use the shared sorted parser.
    data: { '202608': { departure: value }, '202308': { departure: 1.02 } },
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(value = 1.08) {
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse(noaaFixture(value)))
    .mockResolvedValueOnce(jsonResponse({ id: 'created-notification-id' }));
  return { fetchImpl, handler: createWeeklyNotificationHandler({ fetchImpl, env: ENV }) };
}

afterEach(() => vi.useRealTimers());

describe('weekly NOAA notification', () => {
  test('uses the shared NOAA parser and exact science model with current OneSignal targeting/auth', async () => {
    const { fetchImpl, handler } = setup();
    const result = await handler(EVENT);
    const payload = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));

    expect(fetchImpl.mock.calls[0][0]).toBe(getNOAAEndpoint());
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.onesignal.com/notifications');
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Key test-only-app-api-key', 'Content-Type': 'application/json' },
    });
    expect(payload).toMatchObject({
      app_id: APP_ID,
      target_channel: 'push',
      included_segments: ['Subscribed Users'],
      data: { measurement_month: '2026-08', anomaly_celsius: 1.08, ...calculateCFCBias(1.08) },
    });
    expect(payload).not.toHaveProperty('include_external_user_ids');
    expect(payload).not.toHaveProperty('delivery_time_of_day');
    expect(payload.headings.en).toBe('🌊 NOAA monthly ocean context');
    expect(payload.contents.en).toContain('Latest NOAA month: 2026-08');
    expect(payload.contents.en).toContain('modeled thermal solubility proxy, not a measurement');
    expect(payload.contents.en).toContain('fixed salinity');
    expect(payload.contents.en).toContain('NOAA updates monthly');
    expect(result).toMatchObject({
      noaa: { year: 2026, month: 8, value: 1.08 },
      cfcBias: calculateCFCBias(1.08),
      oneSignalId: 'created-notification-id',
      message: 'Notification accepted by OneSignal',
    });
  });

  test('preserves cold anomalies as higher modeled solubility without a plus-minus title', async () => {
    const { fetchImpl, handler } = setup(-0.5);
    const result = await handler(EVENT);
    const payload = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(result.cfcBias.average_reduction_percent).toBeLessThan(0);
    expect(payload.headings.en).not.toContain('-0.50°C');
    expect(payload.headings.en).not.toContain('+-');
    expect(payload.contents.en).not.toContain('higher');
  });

  test('keeps zero modeled change out of the weekly copy', async () => {
    const { fetchImpl, handler } = setup(0);
    await handler(EVENT);
    const payload = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(payload.contents.en).not.toContain('unchanged');
    expect(payload.contents.en).toContain('modeled thermal solubility proxy');
  });

  test.each([
    { ONESIGNAL_APP_ID: APP_ID },
    { ONESIGNAL_API_KEY: 'test-key' },
    { ONESIGNAL_APP_ID: 'not-a-uuid', ONESIGNAL_API_KEY: 'test-key' },
  ])('fails before network when configuration is invalid: %j', async (env) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handler = createWeeklyNotificationHandler({ fetchImpl, env });
    await expect(handler(EVENT)).rejects.toThrow('ONESIGNAL_');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('requires stable schedule metadata before fetching or sending', async () => {
    const { fetchImpl, handler } = setup();
    await expect(handler({})).rejects.toThrow('Schedule event');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('rejects NOAA HTTP failures without calling OneSignal', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}, 503));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
    await expect(handler(EVENT)).rejects.toThrow('NOAA returned HTTP 503');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid NOAA JSON without calling OneSignal', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('not JSON'));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
    await expect(handler(EVENT)).rejects.toThrow('NOAA returned invalid JSON');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each([
    { description: DESCRIPTION, data: {} },
    { description: { ...DESCRIPTION, title: 'Global Land and Ocean Average Temperature Departures' }, data: { '202608': { departure: 1.08 } } },
    { description: DESCRIPTION, data: { '202608': { departure: 'invalid' } } },
  ])('rejects empty, wrong-product, or malformed NOAA data before sending: %j', async (fixture) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(fixture));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
    await expect(handler(EVENT)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('throws OneSignal HTTP failures so Lambda sees a failed invocation', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(noaaFixture()))
      .mockResolvedValueOnce(jsonResponse({ errors: ['Unavailable'] }, 503));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
    await expect(handler(EVENT)).rejects.toThrow('OneSignal returned HTTP 503');
  });

  test('throws when OneSignal returns malformed JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(noaaFixture()))
      .mockResolvedValueOnce(new Response('not JSON'));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
    await expect(handler(EVENT)).rejects.toThrow('OneSignal returned invalid JSON');
  });

  test.each([{}, { id: '' }, { id: null }, { errors: ['All included players are not subscribed'] }])(
    'does not report HTTP 200 without a created notification as success: %j',
    async (response) => {
      const fetchImpl = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(noaaFixture()))
        .mockResolvedValueOnce(jsonResponse(response));
      const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
      await expect(handler(EVENT)).rejects.toThrow('OneSignal did not create a notification');
    },
  );

  test('reuses the idempotency key when AWS repeats the same scheduled occurrence', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(noaaFixture()))
      .mockResolvedValueOnce(jsonResponse({ id: 'first-notification' }))
      .mockResolvedValueOnce(jsonResponse(noaaFixture()))
      .mockResolvedValueOnce(jsonResponse({ id: 'first-notification' }));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV });
    const first = await handler(EVENT);
    const retry = await handler(EVENT);
    const firstPayload = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    const retryPayload = JSON.parse(String(fetchImpl.mock.calls[3][1]?.body));
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(retryPayload.idempotency_key).toBe(firstPayload.idempotency_key);
  });

  test('aborts a hung NOAA fetch and never sends', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV, requestTimeoutMs: 100 });
    const assertion = expect(handler(EVENT)).rejects.toThrow('NOAA request timed out after 100 ms');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('aborts a hung OneSignal request and rejects the invocation', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(noaaFixture()))
      .mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV, requestTimeoutMs: 100 });
    const assertion = expect(handler(EVENT)).rejects.toThrow('OneSignal request timed out after 100 ms');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  test('keeps the timeout active while reading a response body', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementationOnce(async (_url, options) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    } as Response));
    const handler = createWeeklyNotificationHandler({ fetchImpl, env: ENV, requestTimeoutMs: 100 });
    const assertion = expect(handler(EVENT)).rejects.toThrow('NOAA request timed out after 100 ms');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('scheduled notification identity', () => {
  test('generates a standards-shaped UUIDv5 and accepts equivalent legacy scheduled events', () => {
    const key = getNotificationIdempotencyKey(EVENT, APP_ID);
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getNotificationIdempotencyKey({ resources: [EVENT.scheduleArn], time: EVENT.scheduledTime }, APP_ID)).toBe(key);
    expect(getNotificationIdempotencyKey({ ...EVENT, scheduledTime: '2026-09-21T09:00:00.000Z' }, APP_ID)).toBe(key);
  });

  test('separates different scheduled occurrences, schedules, and OneSignal apps', () => {
    const key = getNotificationIdempotencyKey(EVENT, APP_ID);
    expect(getNotificationIdempotencyKey({ ...EVENT, scheduledTime: '2026-09-28T09:00:00Z' }, APP_ID)).not.toBe(key);
    expect(getNotificationIdempotencyKey({ ...EVENT, scheduleArn: 'another-schedule' }, APP_ID)).not.toBe(key);
    expect(getNotificationIdempotencyKey(EVENT, 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee')).not.toBe(key);
  });

  test.each(['invalid', '2026-09-21', '2026-13-21T09:00:00Z'])('rejects invalid scheduled times: %s', (scheduledTime) => {
    expect(() => getNotificationIdempotencyKey({ ...EVENT, scheduledTime }, APP_ID)).toThrow('valid scheduledTime');
  });
});
