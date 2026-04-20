import { describeBackend } from '@hookplane/backend'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import path from 'path'
import * as schema from './db/schema.js'

export type PgsqlBackendConfig = {
    databaseUrl: string
    runMigrations: boolean
}

type PgsqlBackendState = {
    db: ReturnType<typeof drizzle<typeof schema>>,
}

export const createPgsqlBackend = describeBackend<PgsqlBackendConfig, PgsqlBackendState>({
    name: 'pgsql',
    init: async ({ databaseUrl, runMigrations = true }) => {
        const db = drizzle(databaseUrl, { schema })
        if (runMigrations) {
            await migrate(db, {
                migrationsFolder: path.join(__dirname, '../drizzle/')
            })
        }
        return { db }
    },
    state: {
        read: () => { throw '' },
        write: () => { throw '' },
        delete: () => { throw '' },
    },
    signingSecret: {
        read: () => { throw '' },
        write: () => { throw '' },
        delete: () => { throw '' },
    },
})

