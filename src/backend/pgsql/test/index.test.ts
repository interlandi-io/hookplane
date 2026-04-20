import { Client } from 'pg'
import { createPgsqlBackend } from '~/index.js'
import * as schema from '../src/db/schema.js'
import { Backend } from '@hookplane/backend'

const databaseUrl = process.env['DATABASE_URL']
const describeIntegration = databaseUrl ? describe : describe.skip
const itWrapped = 
    (name: string, fn: (params: { backend: Backend, client: Client }) => Promise<void>) => {
        it(name, async () => {
            const backend = await createPgsqlBackend({
                databaseUrl: databaseUrl!,
                runMigrations: true,
            })()

            const client = new Client({ connectionString: databaseUrl })
            await client.connect()

            try {
                await fn({ backend, client })
            } finally {
                await client.end()
            }
                
        })
    }

describeIntegration('pgsql backend', () => {
    itWrapped('initializes and runs migrations', async ({ backend, client }) => {
        expect(backend.name).toBe('pgsql')
        const tables = await client.query<typeof schema>(`
            SELECT
                to_regclass('public.providers') AS providers,
                to_regclass('public.endpoints') AS endpoints,
                to_regclass('public.secrets') AS secrets
        `)

        expect(tables.rows[0]).toEqual({
            providers: 'providers',
            endpoints: 'endpoints',
            secrets: 'secrets',
        })
    })
})
