# ADR-0005: Comprehensive Audit Logging for Compliance

## Status

Accepted

## Date

2024-01-15

## Context

ProjectScaffolder targets enterprise customers who require:
- SOC 2 Type II compliance
- GDPR compliance
- Complete audit trails for all operations
- Forensic investigation capabilities
- Compliance reporting

We need to implement an audit logging system that captures all significant events.

## Decision

Implement a comprehensive audit logging system with the following characteristics:

**Key implementation details:**

```typescript
// src/lib/compliance/audit.ts
interface AuditLogEntry {
  userId: string | null;
  action: string;          // CREATE, READ, UPDATE, DELETE, LOGIN, etc.
  resource: string;        // User, Project, Deployment, etc.
  resourceId: string | null;
  oldValue: object | null;
  newValue: object | null;
  details: object | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  severity: AuditSeverity;
  category: string | null;
}

// Convenience methods
audit.create(userId, resource, resourceId, details);
audit.read(userId, resource, resourceId, details);
audit.update(userId, resource, resourceId, details);
audit.delete(userId, resource, resourceId, details);
audit.error(userId, resource, action, errorMessage, details);
audit.security(userId, action, details, severity);
```

**What gets logged:**
- All CRUD operations on protected resources
- Authentication events (login, logout, failures)
- Authorization failures (permission denied)
- Security events (suspicious activity)
- System errors with context

## Consequences

### Positive

- **Compliance**: Meets SOC 2 and GDPR requirements
- **Forensics**: Complete trail for incident investigation
- **Accountability**: Who did what, when, from where
- **Debugging**: Context for production issues
- **Reporting**: Data for compliance audits

### Negative

- **Storage cost**: Audit logs grow continuously
- **Performance**: Additional write on every operation
- **Privacy**: Must handle PII in logs carefully
- **Complexity**: Need retention and anonymization policies

### Neutral

- Need to balance detail vs. noise
- Export functionality required for auditors

## Alternatives Considered

### Third-Party Audit Service

Use a service like Datadog, Splunk, or specialized audit platforms.

**Rejected because:**
- Additional cost and vendor dependency
- Data leaves our control
- Simpler to start with built-in logging
- Can add third-party later if needed

### Minimal Logging

Log only authentication and errors.

**Rejected because:**
- Insufficient for SOC 2 compliance
- Cannot reconstruct data access patterns
- Limited forensic capability

### Event Sourcing

Full event sourcing architecture.

**Rejected because:**
- Overkill for current requirements
- Significant architectural complexity
- Higher development cost

## Implementation Notes

### Audit Log Schema

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     String
  resource   String
  resourceId String?
  oldValue   Json?
  newValue   Json?
  details    Json?
  ipAddress  String?
  userAgent  String?  @db.Text
  requestId  String?
  severity   AuditSeverity @default(INFO)
  category   String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([createdAt])
  @@index([severity])
}
```

### Severity Levels

| Level | Use Case |
|-------|----------|
| DEBUG | Detailed debugging info |
| INFO | Normal operations |
| WARNING | Unexpected but handled |
| ERROR | Operation failures |
| CRITICAL | Security incidents |

### Categories

| Category | Events |
|----------|--------|
| authentication | Login, logout, failures |
| data_access | CRUD operations |
| system | Errors, deployments |
| security | Permission denied, suspicious activity |

### GDPR Considerations

When user requests deletion:
```typescript
// Anonymize user's audit logs
await db.auditLog.updateMany({
  where: { userId },
  data: {
    userId: null,
    ipAddress: "[REDACTED]",
    userAgent: "[REDACTED]",
    details: null,
  },
});
```

### Retention Policy

| Environment | Retention |
|-------------|-----------|
| Production | 7 years (compliance) |
| Development | 30 days |

### Export Format

```typescript
// JSON export for auditors
const logs = await getAuditLogs(filters);
const json = JSON.stringify(logs, null, 2);

// CSV export for analysis
const csv = exportAuditLogs(filters, 'csv');
```

## Performance Considerations

1. **Async writes**: Don't block request response
2. **Batch inserts**: For high-volume scenarios
3. **Indexes**: On commonly queried fields
4. **Archival**: Move old logs to cold storage

## References

- [SOC 2 Audit Log Requirements](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/socforserviceorganizations.html)
- [GDPR Article 30 - Records of Processing](https://gdpr-info.eu/art-30-gdpr/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
