// Resource-specific redaction whitelist (doc 07 §5). Only approved fields are
// stored in AuditLog.before/after; passwords, tokens and secrets are never kept.

const SENSITIVE_KEY = /password|token|secret|authorization|credential|apikey|api_key/i;

const WHITELISTS: Record<string, Set<string>> = {
  user: new Set(['id', 'email', 'username', 'name', 'phone', 'isActive', 'roles', 'roleIds']),
  role: new Set(['id', 'name', 'description', 'permissionKeys', 'isSystem']),
  permission: new Set(['id', 'key', 'description', 'isProtected']),
  menu: new Set(['id', 'name', 'url', 'icon', 'parentId', 'order', 'isActive', 'permissionIds']),
  delegation: new Set([
    'id',
    'granteeId',
    'permissionKey',
    'grantedBy',
    'parentCapabilityId',
    'invalidatedDescendantIds',
    'expiresAt',
  ]),
};

function maskEmail(value: unknown): string {
  const text = String(value);
  const at = text.indexOf('@');
  if (at < 0) return '***';
  return `${text.slice(0, 1)}***${text.slice(at)}`;
}

function maskPhone(value: unknown): string {
  const text = String(value);
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function redactValue(value: unknown, allowed?: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item, allowed));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      if (allowed && !allowed.has(key)) continue;
      if (key === 'email') result[key] = maskEmail(nested);
      else if (key === 'phone') result[key] = maskPhone(nested);
      else result[key] = redactValue(nested, allowed);
    }
    return result;
  }
  return value;
}

export function redactAuditPayload(value: unknown, resourceType?: string): unknown {
  if (value === undefined || value === null) return null;
  return redactValue(value, resourceType ? WHITELISTS[resourceType] : undefined);
}
