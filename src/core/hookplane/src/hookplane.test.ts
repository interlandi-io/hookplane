import { hookplane } from './hookplane.js'
import { stripeProvider } from '@hookplane/stripe'

const hp = await hookplane({
    providers: {
        stripe: {
            provider: await stripeProvider({
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
