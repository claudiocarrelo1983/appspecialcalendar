// Accept the same HEX/RGB formats as the club settings, never arbitrary CSS.
export function normalizeCompanyColor(value) {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (/^#[a-f0-9]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[a-f0-9]{3}$/i.test(color)) return '#' + [...color.slice(1)].map(c => c + c).join('').toLowerCase();
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(color);
  if (rgb && rgb.slice(1).every(channel => Number(channel) <= 255)) {
    return '#' + rgb.slice(1).map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  }
  return null;
}
