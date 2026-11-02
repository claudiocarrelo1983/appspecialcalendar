import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { normalizeCompanyColor } from './companyColor';

// Branding belongs to the company, so it can survive sign-out and app restarts.
// The build color is only the fallback before we have a saved server setting.
export default function useCompanyColor(companyCode, serverColor, fallback) {
  const live = normalizeCompanyColor(serverColor);
  const key = 'company-brand-color-' + companyCode;
  const [saved, setSaved] = useState(null);
  const serverSeen = useRef(false);
  if (live) serverSeen.current = true;
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(key).then(value => {
      if (active && !serverSeen.current) setSaved(normalizeCompanyColor(value));
    }).catch(() => {});
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    if (!live) return;
    setSaved(live);
    SecureStore.setItemAsync(key, live).catch(() => {});
  }, [key, live]);
  return live || saved || fallback;
}
