import { describe, expect, it } from 'vitest';

import {
  allowedRequestTransitions,
  canResendRequest,
  canTransitionRequest,
  fulfilledStatusFor,
  isOpenRequest,
  isRequestKind,
  isRequestStatus,
  statusAfterResend,
} from './request';

describe('document-request state machine', () => {
  it('allows the valid forward transitions', () => {
    expect(canTransitionRequest('requested', 'viewed')).toBe(true);
    expect(canTransitionRequest('requested', 'sent')).toBe(true);
    expect(canTransitionRequest('sent', 'viewed')).toBe(true);
    expect(canTransitionRequest('viewed', 'received')).toBe(true);
    expect(canTransitionRequest('viewed', 'downloaded')).toBe(true);
  });

  it('allows fulfilment directly from requested/sent (view may not have logged)', () => {
    expect(canTransitionRequest('requested', 'received')).toBe(true);
    expect(canTransitionRequest('sent', 'downloaded')).toBe(true);
  });

  it('allows expiry/cancel from any open status', () => {
    for (const from of ['requested', 'sent', 'viewed'] as const) {
      expect(canTransitionRequest(from, 'expired')).toBe(true);
      expect(canTransitionRequest(from, 'cancelled')).toBe(true);
    }
  });

  it('treats fulfilled and closed statuses as terminal (no regression)', () => {
    for (const terminal of ['received', 'downloaded', 'expired', 'cancelled'] as const) {
      expect(allowedRequestTransitions(terminal)).toEqual([]);
      expect(canTransitionRequest(terminal, 'viewed')).toBe(false);
    }
  });

  it('marks requested/sent/viewed as open, the rest as not', () => {
    expect(isOpenRequest('requested')).toBe(true);
    expect(isOpenRequest('sent')).toBe(true);
    expect(isOpenRequest('viewed')).toBe(true);
    expect(isOpenRequest('received')).toBe(false);
    expect(isOpenRequest('downloaded')).toBe(false);
    expect(isOpenRequest('expired')).toBe(false);
    expect(isOpenRequest('cancelled')).toBe(false);
  });

  it('maps each kind to its fulfilled status', () => {
    expect(fulfilledStatusFor('upload_request')).toBe('received');
    expect(fulfilledStatusFor('document_offer')).toBe('downloaded');
  });

  it('allows resend only from open statuses', () => {
    expect(canResendRequest('requested')).toBe(true);
    expect(canResendRequest('sent')).toBe(true);
    expect(canResendRequest('viewed')).toBe(true);
    expect(canResendRequest('received')).toBe(false);
    expect(canResendRequest('cancelled')).toBe(false);
  });

  it('advances requested→sent on resend but never regresses viewed', () => {
    expect(statusAfterResend('requested')).toBe('sent');
    expect(statusAfterResend('sent')).toBe('sent');
    expect(statusAfterResend('viewed')).toBe('viewed'); // keep "client already opened"
  });

  it('guards the status and kind types', () => {
    expect(isRequestStatus('viewed')).toBe(true);
    expect(isRequestStatus('bogus')).toBe(false);
    expect(isRequestKind('upload_request')).toBe(true);
    expect(isRequestKind('bogus')).toBe(false);
  });
});
