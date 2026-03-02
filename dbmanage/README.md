# ApiCortex DB Manage

This folder is the single place for schema sync and migration management using Bun + Drizzle.

## Environment Variables

Loaded from `../.env`:

- `DATABASE` for core control-plane NeonDB
- `TIMESCALE_DATABASE` for TimescaleDB
- `TIMESCALE_CA_CERT_PATH` optional CA certificate path for Timescale TLS verification
- `KAFKA_CA_CERT_PATH` used as fallback CA certificate path
- `TIMESCALE_SSLMODE` optional SSL mode override (default: `verify-full`)
- `TIMESCALE_USE_LIBPQ_COMPAT` optional (`true`/`false`), when `true` uses `uselibpqcompat=true&sslmode=require`

## Setup

```bash
cd dbmanage
bun install
```

## Core DB (Neon)

```bash
bun run db:generate:core
bun run db:push:core
bun run db:migrate:core
bun run db:studio:core
```

## Timescale DB

```bash
bun run db:generate:timescale
bun run db:push:timescale
bun run db:migrate:timescale
bun run db:hypertable:timescale
bun run db:sync:timescale
bun run db:inspect:timescale
bun run db:studio:timescale
```

## Notes

- Core schema source: `src/core/schema.ts`
- Timescale schema source: `src/timescale/schema.ts`
- Generated SQL output:
  - `drizzle/core/`
  - `drizzle/timescale/`
