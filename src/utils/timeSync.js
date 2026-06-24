import { getServerTime } from '../api/apiRoutes';

let timeOffset = 0;

export async function initTimeSync() {
  try {
    const start = Date.now();
    const res = await getServerTime();
    const serverTimeMs = new Date(res.data.time).getTime();
    const latency = (Date.now() - start) / 2;
    timeOffset = (serverTimeMs + latency) - Date.now();
    console.log(`[TimeSync] Server time synchronized. Offset: ${timeOffset}ms`);
  } catch (err) {
    console.error('[TimeSync] Failed to sync time with server, falling back to local time:', err);
    timeOffset = 0;
  }
}

export function getSyncedDate() {
  return new Date(Date.now() + timeOffset);
}

export function getSyncedTimeOffset() {
  return timeOffset;
}
