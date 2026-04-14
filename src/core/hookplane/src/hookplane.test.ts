import { hookplane } from './hookplane.js'
import { stripeProvider } from '@hookplane/stripe'

describe('hookplane', () => {
    it('constructs', async () => {
        const hp = await hookplane({
            baseUrl: 'https://localhost:3000',
            providers: {
                stripe: {
                    provider: await stripeProvider({
                        apiKey: process.env['STRIPE_API_KEY']!,
                    }),
                    endpoint: '/hooks/stripe',
                    events: ['checkout.session.completed'],
                    endpointConfig: {
                        name: 'my_endpoint',
                        eventPayload: 'snapshot',
                    },
                },
            },
        })
        expect(hp.state.baseUrl).toBe('https://localhost:3000')
        expect(hp.state.providers['stripe']).toBeDefined()
        expect(hp.state.providerStates['stripe']).toBeDefined()
        const arr = [...hp.state.providerStates['stripe']!.values()]
        expect(arr[0]).toBeDefined()
        expect(arr[0]!.relativeUrl).toBe('/hooks/stripe')
    })
})
