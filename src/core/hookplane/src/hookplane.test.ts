import { hookplane } from './hookplane.js'
import { stripeProvider } from '@hookplane/stripe'

describe('hookplane', () => {
    it('constructs', async () => {
        const hp = await hookplane({
            providers: {
                stripe: {
                    provider: await stripeProvider({
                        apiKey: process.env['STRIPE_API_KEY']!,
                    }),
                    endpoint: 'https://localhost:3000/hooks/stripe',
                    events: ['checkout.session.completed'],
                    endpointConfig: {
                        name: 'my_endpoint',
                        eventPayload: 'snapshot',
                    },
                },
            },
        })
        expect(hp.state.providers['stripe']).toBeDefined()
        expect(hp.state.providerStates['stripe']).toBeDefined()
        const arr = [...hp.state.providerStates['stripe']!.values()]
        expect(arr[0]).toBeDefined()
        expect(arr[0]!.url).toBe('https://localhost:3000/hooks/stripe')
    })
})
