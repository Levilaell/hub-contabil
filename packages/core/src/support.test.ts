import { describe, expect, it } from 'vitest';

import {
  allowedSupportTransitions,
  canTransitionSupport,
  decideSupportResponse,
  isOpenSupport,
  isWithin24hWindow,
  statusAfterInbound,
} from './support';

describe('support state machine', () => {
  it('allows the documented transitions', () => {
    expect(canTransitionSupport('open', 'pending')).toBe(true);
    expect(canTransitionSupport('open', 'escalated')).toBe(true);
    expect(canTransitionSupport('escalated', 'resolved')).toBe(true);
    expect(canTransitionSupport('resolved', 'open')).toBe(true);
  });

  it('rejects undocumented transitions', () => {
    expect(canTransitionSupport('resolved', 'pending')).toBe(false);
    expect(canTransitionSupport('open', 'open')).toBe(false);
  });

  it('lists allowed targets', () => {
    expect(allowedSupportTransitions('escalated')).toEqual(['pending', 'resolved']);
    expect(allowedSupportTransitions('resolved')).toEqual(['open']);
  });
});

describe('statusAfterInbound', () => {
  it('reopens a resolved ticket and resurfaces a pending one', () => {
    expect(statusAfterInbound('resolved')).toBe('open');
    expect(statusAfterInbound('pending')).toBe('open');
  });

  it('keeps an escalated ticket escalated (a human is already on it)', () => {
    expect(statusAfterInbound('escalated')).toBe('escalated');
  });
});

describe('isOpenSupport', () => {
  it('counts open and escalated as needing attention', () => {
    expect(isOpenSupport('open')).toBe(true);
    expect(isOpenSupport('escalated')).toBe(true);
    expect(isOpenSupport('pending')).toBe(false);
    expect(isOpenSupport('resolved')).toBe(false);
  });
});

describe('decideSupportResponse', () => {
  const base = { autoReplyEnabled: true, inScope: true, confidence: 0.9, threshold: 0.8 };

  it('lets the AI reply only when enabled, in scope and confident', () => {
    expect(decideSupportResponse(base)).toEqual({ action: 'ai_reply', reason: 'ok' });
  });

  it('escalates when auto-reply is disabled, before anything else', () => {
    expect(decideSupportResponse({ ...base, autoReplyEnabled: false, inScope: false })).toEqual({
      action: 'escalate',
      reason: 'auto_reply_disabled',
    });
  });

  it('escalates out-of-scope questions', () => {
    expect(decideSupportResponse({ ...base, inScope: false })).toEqual({
      action: 'escalate',
      reason: 'out_of_scope',
    });
  });

  it('escalates low-confidence answers (threshold inclusive = confident)', () => {
    expect(decideSupportResponse({ ...base, confidence: 0.79 }).action).toBe('escalate');
    expect(decideSupportResponse({ ...base, confidence: 0.8 }).action).toBe('ai_reply');
  });
});

describe('isWithin24hWindow', () => {
  it('is true within 24h and false after', () => {
    const last = '2026-06-29T10:00:00.000Z';
    expect(isWithin24hWindow(last, '2026-06-29T20:00:00.000Z')).toBe(true);
    expect(isWithin24hWindow(last, '2026-06-30T11:00:00.000Z')).toBe(false);
  });

  it('is false for unparseable input', () => {
    expect(isWithin24hWindow('not-a-date', '2026-06-29T20:00:00.000Z')).toBe(false);
  });
});
