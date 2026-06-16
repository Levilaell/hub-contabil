'use client';

import { useEffect } from 'react';

import { logViewAction } from './actions';

// Fires the "viewed" log once on real client mount. Kept off the server render
// so link-preview bots (WhatsApp/Slack/email unfurlers) that GET the page don't
// flip the status to viewed before the client actually opens it. No state — just
// a fire-and-forget effect, so it doesn't trip the set-state-in-effect rule.
export function ViewLogger({ token }: { token: string }) {
  useEffect(() => {
    void logViewAction(token);
  }, [token]);
  return null;
}
