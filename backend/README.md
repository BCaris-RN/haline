/*
 *                    .-"""""-.
 *                  .'  .---.  '.
 *                 /  .'     '.  \
 *                /  /         \  \
 *               /  /           \  \
 *              /  /             \  '.
 *            .'  /               '.  '.
 *      .----'  .'                  '.  '-.____
 *     (  .----'                      '-.____  )
 *      '-'                                  '-'
 *
 *     _   _    _    _     ___ _   _ _____
 *    | | | |  / \  | |   |_ _| \ | | ____|
 *    | |_| | / _ \ | |    | ||  \| |  _|
 *    |  _  |/ ___ \| |___ | || |\  | |___
 *    |_| |_/_/   \_\_____|___|_| \_|_____|
 *    ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~
 *    Ocean climate, measured.
 *
 *    lib/paywallConfig.ts
 *    Subscription products, entitlements, and paywall copy.
 *
 *    Science: Caris (2026) · doi:10.5281/zenodo.20804280
 *    License: MIT
 */
 
# Weekly ocean notification Lambda

The handler fetches the latest NOAA monthly **global ocean** anomaly and bundles
the same NOAA validation and Warner–Weiss calculation used by the app. It reports
modeled CFC-11/12 solubility change at fixed salinity and a 15°C model baseline.
This is an educational equilibrium-solubility calculation, not measured ocean
uptake or an emissions inversion. NOAA's anomaly reference period is distinct
from the model's chosen 15°C baseline; see the root science notes.

## Build and test locally

From the repository root:

```powershell
npm ci
npm test
npm run type-check
npm run build:backend
```

The build creates `backend/dist/weekly-notification.js`, its source map, and a
CommonJS `package.json`. It bundles the shared TypeScript science and NOAA parser;
there are no runtime npm dependencies. Uploading only the source Lambda file
would omit its required shared modules. Package the **contents** of `backend/dist`
at the ZIP root, select a supported Node.js runtime (Node.js 22 or later), and use
handler `weekly-notification.handler`. Configure a 30-second Lambda timeout; each
outbound request times out after 10 seconds, including response-body reading.

No AWS resources are provisioned and no notifications are sent by these commands.
All backend tests use mocked fetch responses.

## Configuration before deployment

Set these **server-side Lambda** environment variables:

| Variable | Value |
| --- | --- |
| `ONESIGNAL_APP_ID` | OneSignal app UUID |
| `ONESIGNAL_API_KEY` | Raw OneSignal App API key |

Keep the API key out of mobile bundles, source control, and logs. No Base64 or
`ONESIGNAL_AUTH_HEADER` is needed. Requests use the current
[OneSignal create-message API](https://documentation.onesignal.com/reference/create-message):
`POST https://api.onesignal.com/notifications`, `Authorization: Key <app-api-key>`,
and the existing `Subscribed Users` segment for the push channel. Ensure the app
has subscribed push devices in that segment before enabling a schedule. A returned
notification ID means API acceptance; it does not prove device delivery. HTTP 200
without an ID is treated as failure instead of reporting a notification as sent.

## Weekly schedule

Configure [EventBridge Scheduler](https://docs.aws.amazon.com/lambda/latest/dg/with-eventbridge-scheduler.html)
with:

- Schedule expression: `cron(0 9 ? * MON *)`.
- Time zone: `UTC` (Monday at 09:00 UTC, per the build brief).
- Flexible time window: off.
- Target: the deployed Lambda ARN.
- Execution role: permission to invoke that Lambda.
- Target input:

```json
{
  "scheduleArn": "<aws.scheduler.schedule-arn>",
  "scheduledTime": "<aws.scheduler.scheduled-time>"
}
```

Scheduler replaces these [context placeholders](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule-context-attributes.html).
Legacy scheduled-rule events are also accepted through `resources[0]` and `time`.
Manual invocation requires an explicit schedule ARN or stable test identifier and
an ISO scheduled time, for example:

```json
{
  "scheduleArn": "haline-weekly-manual-test",
  "scheduledTime": "2026-09-21T09:00:00Z"
}
```

**Invoking the configured handler sends a real notification to subscribed users.**
Use a separate OneSignal test app for deployment validation. Reusing the same
event and app ID reuses the notification's UUIDv5 idempotency key. Different
scheduled times produce different keys. OneSignal retains
[notification idempotency keys for 30 days](https://documentation.onesignal.com/reference/idempotent-notification-requests),
so do not replay old events outside that window expecting deduplication.

## Failures and retries

Missing configuration, invalid schedule metadata, NOAA failures, invalid data,
timeouts, and unsuccessful OneSignal responses reject the Lambda invocation.
Failure before a valid NOAA calculation never calls OneSignal. The handler
preserves the sign of the model result: a cold anomaly reports higher modeled
solubility instead of clamping it to zero. The monthly observation date is always
included; running weekly does not make NOAA's monthly product weekly data.

Scheduler invokes Lambda **asynchronously**. Configure both Scheduler's delivery
retry/dead-letter settings and Lambda's asynchronous failure destination or dead
letter queue. These cover different failure stages. Lambda normally retries
function failures twice; returning an HTTP-shaped `500` object would not trigger
those retries. See [Lambda asynchronous error handling](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html).
Retries of one scheduled occurrence reuse the same OneSignal idempotency key,
including after an ambiguous network timeout. The handler does not perform its own
immediate retry loop; monitor failures, and honor OneSignal's `Retry-After` guidance
when deciding any operator-managed retries.
