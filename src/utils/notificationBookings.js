import { classLinkTarget } from './classLinks';
import { validClientBookings } from './clientBookingsCore';

export async function notificationBookings(rows, base, request) {
  const result = {}, groups = new Map();
  for (const notice of rows.filter(row => row.bookingUrl).slice(0, 20)) {
    let query;
    try {
      const link = classLinkTarget(new URL(notice.bookingUrl, base).href, base);
      if (!link) throw Error('invalid_response');
      const url = new URL(link);
      if (!url.searchParams.has('date') || !url.searchParams.has('schedule_id')) throw Error('invalid_response');
      query = { date: url.searchParams.get('date'), company_code: url.searchParams.get('company_code') || undefined };
      const key = JSON.stringify(query);
      if (!groups.has(key)) groups.set(key, { query, notices: [] });
      groups.get(key).notices.push({ notice, schedule: url.searchParams.get('schedule_id') });
    } catch { result[notice.id] = { row: null, error: 'invalid_response' }; }
  }
  const queue = [...groups.values()];
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const group = queue.shift();
      try {
        const response = await request('schedule', group.query), page = response?.data;
        if (response?.success !== true || !validClientBookings(page) || page.date !== group.query.date
          || (group.query.company_code && page.companyCode !== group.query.company_code)) throw Error('invalid_response');
        for (const { notice, schedule } of group.notices) {
          const row = page.rows.find(item => String(item.schedule_id) === schedule && item.date === group.query.date);
          // Require evidence for this recipient/occurrence, never the notice's read state.
          if (row?.booked === true && (!Number.isSafeInteger(row.booking_id) || row.booking_id < 1
            || row.booking_client_guid !== page.clientGuid)) {
            result[notice.id] = { row: null, error: 'invalid_response' }; continue;
          }
          result[notice.id] = { row: row || null, error: row ? '' : 'unavailable' };
        }
      } catch { for (const { notice } of group.notices) result[notice.id] = { row: null, error: 'offline' }; }
    }
  }));
  return result;
}
export function notificationBookingAction(row) {
  return row?.actions?.find(action => action.kind === (row.booked ? 'cancel-booking' : 'book')) || null;
}
