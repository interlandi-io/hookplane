import { hookplane } from 'hookplane'
import { stripeProvider } from '@hookplane/stripe'

const hp = await hookplane({
    providers: {
        stripe: {
            provider: await stripeProvider({
                // eslint-disable-next-line turbo/no-undeclared-env-vars
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
})

export default hp
