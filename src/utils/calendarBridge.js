export const CALENDAR_MESSAGE_TYPE = 'gym.calendar.create';

export function trustedCalendarOrigin(url, startUrl) {
  try {
    const origin = new URL(url).origin;
    return [
      new URL(startUrl).origin,
      'https://specialcalendar.com',
      'https://www.specialcalendar.com',
      'https://specialcalendar.pt',
      'https://www.specialcalendar.pt',
    ].includes(origin);
  } catch {
    return false;
  }
}

export function calendarEventFromMessage(message) {
  if (message?.type !== CALENDAR_MESSAGE_TYPE || message.version !== 1) {
    throw new Error('Unsupported calendar message');
  }
  const event = message.event;
  if (!event || typeof event.title !== 'string' || !event.title.trim() || event.title.length > 500) {
    throw new Error('Invalid calendar title');
  }
  const utcDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (typeof event.startDate !== 'string' || typeof event.endDate !== 'string'
      || !utcDate.test(event.startDate) || !utcDate.test(event.endDate)) {
    throw new Error('Invalid calendar dates');
  }
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate
      || startDate.toISOString().replace('.000Z', 'Z') !== event.startDate
      || endDate.toISOString().replace('.000Z', 'Z') !== event.endDate) {
    throw new Error('Invalid calendar duration');
  }
  for (const field of ['location', 'notes', 'url']) {
    if (typeof event[field] !== 'string' || event[field].length > 20000) {
      throw new Error('Invalid calendar details');
    }
  }
  const url = new URL(event.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid event URL');
  return {
    title: event.title.trim(), startDate, endDate,
    location: event.location, notes: event.notes, url: event.url,
    timeZone: 'Europe/Lisbon',
  };
}
