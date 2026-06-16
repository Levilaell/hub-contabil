// Document-request state machine (T16, PLANEJAMENTO §5). Pure — the single
// source of truth for valid transitions. The SQL RPCs that drive the public
// page (log_request_view, record_request_upload, record_request_download) MUST
// mirror these guards; if they drift, the public surface and the firm UI
// disagree about a request's state.
//
// A request is created as `requested`. T17 marks it `sent` when the link is
// e-mailed. Opening the public link moves it to `viewed`. Then it ends in
// `received` (client uploaded the asked-for document) or `downloaded` (client
// fetched an offered document). `expired` is decided at read time from the
// token's expires_at; `cancelled` is a firm action. The last three are terminal.

export const REQUEST_STATUSES = [
  'requested',
  'sent',
  'viewed',
  'received',
  'downloaded',
  'expired',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  requested: ['sent', 'viewed', 'received', 'downloaded', 'expired', 'cancelled'],
  sent: ['viewed', 'received', 'downloaded', 'expired', 'cancelled'],
  viewed: ['received', 'downloaded', 'expired', 'cancelled'],
  received: [],
  downloaded: [],
  expired: [],
  cancelled: [],
};

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}

/** The statuses a request can move to from `from` (empty for terminal states). */
export function allowedRequestTransitions(from: RequestStatus): RequestStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// "Open" = still awaiting client action (the firm cares about these on the
// dashboard / follow-up). Fulfilled (received/downloaded) and closed
// (expired/cancelled) requests are not open.
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ['requested', 'sent', 'viewed'];

export function isOpenRequest(status: RequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status);
}

// The two request kinds: ask the client to upload a document, or make one
// available for the client to download.
export const REQUEST_KINDS = ['upload_request', 'document_offer'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export function isRequestKind(value: string): value is RequestKind {
  return (REQUEST_KINDS as readonly string[]).includes(value);
}

// The terminal status a kind reaches when the client completes the interaction.
export function fulfilledStatusFor(
  kind: RequestKind,
): Extract<RequestStatus, 'received' | 'downloaded'> {
  return kind === 'upload_request' ? 'received' : 'downloaded';
}
