// @ts-check

import { createHash } from 'node:crypto';
import { calculateCFCBias } from '../../lib/cfcBias';
import { getLatestRecord, getNOAAEndpoint, parseNOAAResponse } from '../../lib/noaaData';

const ONESIGNAL_ENDPOINT = 'https://api.onesignal.com/notifications';
const REQUEST_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DNS_UUID_NAMESPACE = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');

/**
 * @typedef {{ scheduledTime?: string, scheduleArn?: string, time?: string, resources?: string[] }} ScheduleEvent
 * @typedef {{ fetchImpl?: typeof fetch, env?: Record<string, string | undefined>, requestTimeoutMs?: number }} HandlerDependencies
 */

/**
 * UUIDv5 identifies one scheduled occurrence, including across Lambda retries.
 * AWS request IDs and Scheduler execution IDs change between attempts; never
 * use those or the current wall clock as the notification's identity.
 *
 * @param {ScheduleEvent} event
 * @param {string} appId
 */
export function getNotificationIdempotencyKey(event, appId) {
  const scheduledTime = event?.scheduledTime ?? event?.time;
  const scheduleArn = event?.scheduleArn ?? event?.resources?.[0];
  if (typeof scheduleArn !== 'string' || !scheduleArn.trim()) {
    throw new Error('Schedule event must contain scheduleArn (or legacy resources[0]).');
  }
  if (
    typeof scheduledTime !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledTime) ||
    !Number.isFinite(Date.parse(scheduledTime))
  ) {
    throw new Error('Schedule event must contain a valid scheduledTime (or legacy time).');
  }

  const identity = JSON.stringify([
    'haline-weekly-notification-v1',
    appId,
    scheduleArn,
    new Date(scheduledTime).toISOString(),
  ]);
  const bytes = createHash('sha1').update(DNS_UUID_NAMESPACE).update(identity).digest().subarray(0, 16);
  bytes[6] = (bytes.readUInt8(6) & 0x0f) | 0x50;
  bytes[8] = (bytes.readUInt8(8) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Keep the timeout active while reading the response body as well as headers.
 * Upstream bodies and request headers are deliberately omitted from errors.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {string} service
 * @param {typeof fetch} fetchImpl
 * @param {number} timeoutMs
 * @returns {Promise<unknown>}
 */
async function fetchJSON(url, options, service, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${service} returned HTTP ${response.status}.`);
    }
    try {
      return await response.json();
    } catch {
      if (controller.signal.aborted) throw new Error(`${service} request timed out.`);
      throw new Error(`${service} returned invalid JSON.`);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${service} request timed out after ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create the Lambda entry point. Dependency injection keeps tests offline;
 * production uses Node.js native fetch and Lambda environment variables.
 *
 * @param {HandlerDependencies} [dependencies]
 */
export function createWeeklyNotificationHandler({
  fetchImpl = globalThis.fetch,
  env = process.env,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('requestTimeoutMs must be a positive finite number.');
  }

  /** @param {ScheduleEvent} event */
  return async function weeklyNotification(event) {
    const appId = env.ONESIGNAL_APP_ID?.trim();
    const apiKey = env.ONESIGNAL_API_KEY?.trim();
    if (!appId || !UUID_PATTERN.test(appId)) {
      throw new Error('ONESIGNAL_APP_ID must be a valid OneSignal app UUID.');
    }
    if (!apiKey) throw new Error('ONESIGNAL_API_KEY is required.');

    const idempotencyKey = getNotificationIdempotencyKey(event, appId);
    const noaaEndpoint = getNOAAEndpoint();
    const json = await fetchJSON(noaaEndpoint, {}, 'NOAA', fetchImpl, requestTimeoutMs);
    const noaa = getLatestRecord(parseNOAAResponse(json));
    if (!noaa) throw new Error('NOAA returned no usable monthly ocean observations.');

    const cfcBias = calculateCFCBias(noaa.value);
    const month = noaa.date.slice(0, 7);

    const payload = {
      app_id: appId,
      target_channel: 'push',
      included_segments: ['Subscribed Users'],
      idempotency_key: idempotencyKey,
      headings: { en: '🌊 NOAA monthly ocean context' },
      contents: {
        en: `Latest NOAA month: ${month}. Haline reports a modeled thermal solubility proxy, not a measurement, at fixed salinity and a 15°C baseline. NOAA updates monthly, so weekly notes may repeat context until a new observation posts.`,
      },
      data: {
        measurement_month: month,
        anomaly_celsius: noaa.value,
        ...cfcBias,
        source_url: noaaEndpoint,
      },
    };

    const result = await fetchJSON(
      ONESIGNAL_ENDPOINT,
      {
        method: 'POST',
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'OneSignal',
      fetchImpl,
      requestTimeoutMs,
    );

    // OneSignal can return HTTP 200 without an ID when no subscriptions qualify.
    // That is not a created notification and must remain visible as a failure.
    if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id.trim()) {
      throw new Error('OneSignal did not create a notification; check the subscribed push audience.');
    }

    return {
      message: 'Notification accepted by OneSignal',
      noaa,
      cfcBias,
      oneSignalId: result.id,
      idempotencyKey,
    };
  };
}

// Throwing rejects the invocation so Lambda's asynchronous error policy applies.
// Returning an HTTP-like { statusCode: 500 } would incorrectly count as success.
export const handler = createWeeklyNotificationHandler();
