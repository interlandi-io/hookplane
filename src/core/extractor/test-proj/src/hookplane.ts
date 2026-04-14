import { hookplane } from 'hookplane'
import { stripeProvider } from '@hookplane/stripe'

const hp = await hookplane({
    baseUrl: 'https://example.com',
    providers: {
        stripe: {
            provider: await stripeProvider({
                // eslint-disable-next-line turbo/no-undeclared-env-vars
                apiKey: process.env['STRIPE_API_KEY']!,
            }),
            endpoint: '/hooks/stripe',
            events: ['checkout.session.completed'],
            config: {
                name: 'my_endpoint',
                eventPayload: 'snapshot',
            },
        },
    },
})

export default hp
