import { describe, expect, it } from 'vitest';

import { NoopMessagingAdapter } from './messaging';

describe('NoopMessagingAdapter', () => {
  it('reports success without sending', async () => {
    const adapter = new NoopMessagingAdapter();
    const result = await adapter.sendEmail({ to: 'x@y.test', subject: 'Oi', body: 'corpo' });
    expect(result.ok).toBe(true);
  });
});
