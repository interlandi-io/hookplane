import { createStripeProvider } from '.'
import { crudRoundTrip } from '@hookplane/provider/harness'

const apiKey = process.env['STRIPE_API_KEY']!

describe('CRUD Round Trip: Stripe', async () => {
    await crudRoundTrip(
        async () => {
            return (
                await createStripeProvider({
                    apiKey,
                })
            )._unsafeUnwrap()
        },
        {
            name: 'Event Name',
            description: '',
            eventPayload: 'snapshot',
            metadata: {},
        },
    )
})
