export type SecurityControlStatus = 'active' | 'backend-required' | 'pilot-required';
export type DataClassification = 'public' | 'internal' | 'sensitive' | 'restricted';

export interface SecurityControl {
  id: string;
  title: string;
  description: string;
  status: SecurityControlStatus;
  standard: string;
}

export const legacySensitiveStorageKeys = [
  'userProfile',
  'routeSignals',
  'evParticipantSignals',
  'greenRouteCredits',
  'userRole',
] as const;

export const clearLegacySensitiveStorage = () => {
  legacySensitiveStorageKeys.forEach(key => localStorage.removeItem(key));
};

export const securityControls: SecurityControl[] = [
  {
    id: 'session-memory',
    title: 'Session-memory prototype data',
    description: 'Profile and route signals are cleared when the page session ends and are no longer persisted in localStorage.',
    status: 'active',
    standard: 'OWASP ASVS 5.0 V14',
  },
  {
    id: 'browser-policy',
    title: 'Restrictive browser policy',
    description: 'Content, framing, referrer, permissions, and transport policies are defined for static hosting.',
    status: 'active',
    standard: 'OWASP ASVS 5.0 V3/V14',
  },
  {
    id: 'server-auth',
    title: 'Server-side identity and authorization',
    description: 'Passkeys, MFA, secure cookies, account recovery, and role checks require a connected backend.',
    status: 'backend-required',
    standard: 'NIST SP 800-63B-4',
  },
  {
    id: 'row-security',
    title: 'Database row-level security',
    description: 'Backend-ready SQL policies prevent commuters and route participants from reading one another’s private records.',
    status: 'backend-required',
    standard: 'OWASP ASVS 5.0 V8',
  },
  {
    id: 'audit-events',
    title: 'Protected security audit events',
    description: 'Security-event contracts and an append-only database table are defined; production ingestion requires a trusted server.',
    status: 'backend-required',
    standard: 'OWASP ASVS 5.0 V16',
  },
  {
    id: 'independent-review',
    title: 'Independent security assessment',
    description: 'ASVS Level 2 verification and penetration testing are required before a controlled real-data pilot.',
    status: 'pilot-required',
    standard: 'OWASP ASVS 5.0 Level 2',
  },
];

export const dataClassifications = [
  {
    classification: 'public' as DataClassification,
    examples: 'Published Anchor Point candidates, public EV hubs, general corridor names',
    handling: 'May be displayed publicly after source and partner review.',
  },
  {
    classification: 'internal' as DataClassification,
    examples: 'Synthetic demand counts, prototype configuration, demo score weights',
    handling: 'Available to approved team members; no secrets.',
  },
  {
    classification: 'sensitive' as DataClassification,
    examples: 'Area-level route patterns, time windows, accessibility and privacy preferences',
    handling: 'Authenticated access, least privilege, encryption, retention limits, and audit logging.',
  },
  {
    classification: 'restricted' as DataClassification,
    examples: 'Verification evidence, identity documents, insurance or background-check material',
    handling: 'Do not store in this app. Use a separately reviewed verification provider and strict access boundary.',
  },
];

export type AuditEventAction =
  | 'auth.login.succeeded'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'profile.updated'
  | 'route_request.created'
  | 'driver_route.created'
  | 'match_preview.reviewed'
  | 'verification.status_changed'
  | 'data.exported'
  | 'data.deletion_requested';

export interface AuditEvent {
  action: AuditEventAction;
  actorUserId: string | null;
  entityType: 'profile' | 'route_request' | 'driver_route' | 'match_preview' | 'verification' | 'session';
  entityId: string | null;
  occurredAt: string;
  metadata: Record<string, string | number | boolean>;
}
