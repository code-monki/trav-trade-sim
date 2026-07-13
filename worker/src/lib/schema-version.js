// Schema-drift detection: compares the schema_migrations ledger in a live
// D1 database against the migrations this Worker's code was built for.
//
// Every migration filename's numeric prefix must be added here in the same
// commit as the migration file itself (see d1/011_schema_ledger.sql).
export const EXPECTED_MIGRATIONS = [
  '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011',
]

// Pure — no D1 dependency, so it's directly unit-testable without a database.
export function diffMigrations(applied, expected = EXPECTED_MIGRATIONS) {
  const appliedSet = new Set(applied)
  const missing    = expected.filter(id => !appliedSet.has(id))
  const unexpected = applied.filter(id => !expected.includes(id))
  return { ok: missing.length === 0 && unexpected.length === 0, missing, unexpected }
}

export async function checkSchemaVersion(db) {
  let applied
  try {
    const { results } = await db.prepare('SELECT id FROM schema_migrations').all()
    applied = results.map(r => r.id)
  } catch {
    // Table doesn't exist — a DB older than migration 011's ledger bootstrap
    return { ok: false, applied: [], missing: EXPECTED_MIGRATIONS, unexpected: [] }
  }
  return { applied, ...diffMigrations(applied) }
}
