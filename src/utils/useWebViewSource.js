import { useCallback, useState } from 'react';

// In-page links change the WebView document without changing React's source URI.
// Explicit navigation (for example a QR scan) must also work when that URI is
// still equal to an earlier destination.
export default function useWebViewSource(initialUrl) {
  const [url, setUrl] = useState(initialUrl);
  const [revision, setRevision] = useState(0);
  const navigate = useCallback((target, options = {}) => {
    setUrl(target);
    if (options.reload === true) setRevision(value => value + 1);
  }, []);
  return [url, navigate, revision];
}
