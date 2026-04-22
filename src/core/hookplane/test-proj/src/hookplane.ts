import { hookplane } from 'hookplane'
import { stripeProvider } from '@hookplane/stripe'
import { createPgsqlBackend } from '@hookplane/backend-pgsql'

const hp = await hookplane({
    providers: {
        stripe: {
            provider: await stripeProvider({
                apiKey: process.env['STRIPE_API_KEY']!,
            }),
            endpoint: 'https://example.com/hooks/stripe',
            events: ['checkout.session.completed'],
            endpointConfig: {
                name: 'my_endpoint',
                eventPayload: 'snapshot',
            },
        },
    },
    backend: await createPgsqlBackend({
        databaseUrl: process.env['DATABASE_URL']!,
        runMigrations: true, 
    })
})

export default hp
