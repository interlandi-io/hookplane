import { createStripeProvider } from '.'
import { crudRoundTrip } from '@hookplane/provider/harness'

const apiKey = process.env['STRIPE_API_KEY']!

describe('CRUD Round Trip: Stripe', async () => {
    const Stripe = (
        await createStripeProvider({
            apiKey,
        })
    )._unsafeUnwrap()

    crudRoundTrip(
        Stripe,
        {
            name: 'Event Name',
            description: '',
            eventPayload: 'snapshot',
            metadata: {},
        },
        true,
    )
})
