import { api } from './api.js'
import { useAppErrorStore } from '../stores/appError.js'

// One-time startup check. Unlike a plain network/timeout failure (which the
// rest of the app already tolerates gracefully — see api.js's errorKind),
// schema drift is treated as fatal because continuing to use the app risks
// silently-wrong behavior (e.g. a write rejected by a CHECK constraint the
// Worker's code assumes already exists).
export async function checkSchemaHealth() {
  const { error, errorKind, schema_ok, missing_migrations, unexpected_migrations } = await api.get('/api/health')
  if (errorKind !== 'http' || schema_ok !== false) return // network/timeout/config issues are not this check's concern

  useAppErrorStore().setFatalError({
    kind: 'schema-drift',
    message: error,
    missing: missing_migrations,
    unexpected: unexpected_migrations,
  })
}
