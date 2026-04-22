# `@hookplane/backend-pgsql`

For local integration tests, start the package-local Postgres container:

```bash
pnpm db:up
```

The canonical test connection string is:

```bash
postgresql://hookplane:hookplane@127.0.0.1:54329/hookplane_test
```

Run the DB-backed test suite:

```bash
pnpm test:integration
```

Stop and remove the test database:

```bash
pnpm db:down
```
