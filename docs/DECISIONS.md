# Build decisions

- Follow PRD v1.1. New recipient requirement is included.
- Local preview runs only with APP_MODE=demo and APP_ENV=local, never on Vercel; API additionally checks loopback host. Sample records are synthetic. Data is saved to ignored embedded PostgreSQL at .local/postgres using the actual application migrations. This replaces the initially proposed JSON preview; hosted Supabase services remain separate.
- Connected mode uses Supabase Postgres and user-scoped RPCs; missing configuration shows setup instructions rather than fake connected success.
- Initial API uses a single validated command endpoint and workspace read endpoint to keep the local/connected adapters consistent. These are an implementation consolidation of the PRD contracts, not a permissions relaxation.
- Local PostgreSQL tests use PGlite because Docker is absent; hosted Supabase integration remains an explicit release gate.
- Interface: forest-green office navigation, slate work surface, readable agenda and clear date-adjustment explanations.

