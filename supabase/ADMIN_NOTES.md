# Supabase Admin Notes

## Manual PIN Reset

If a user cannot access the recovery code flow (e.g. an old campaign created
before migration 014), a PIN can be reset directly in the Supabase dashboard.

1. Open the Supabase project → **Table Editor** → `players`
2. Filter by `character_name` and `campaign_id` (join via the `campaigns` table
   if you only know the campaign code)
3. In the **SQL Editor**, run:

```sql
update players
set pin_hash        = crypt('NEW_PIN_HERE', gen_salt('bf', 10)),
    failed_attempts = 0,
    locked_until    = null
where character_name = 'CHARACTER_NAME'
  and campaign_id = (select id from campaigns where code = 'CAMPAIGN_CODE');
```

Replace `NEW_PIN_HERE`, `CHARACTER_NAME`, and `CAMPAIGN_CODE` with the actual
values. The user can then sign in with the new PIN and change it if desired
(PIN change UI is not yet implemented — they are stuck with whatever you set
until that feature is added).

## Manual Recovery Code Reset

If a referee has lost their recovery code, generate a new one:

```sql
update campaigns
set recovery_code_hash = crypt(upper('NEW-RECOVERY-CODE-HERE'), gen_salt('bf', 10))
where code = 'CAMPAIGN_CODE';
```

Then communicate the new recovery code to the referee out of band. The code
can be any string of 4+ characters — a UUID is recommended for security.
