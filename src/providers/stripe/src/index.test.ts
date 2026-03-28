import { createStripeProvider } from '.'
import { crudRoundTrip } from '@hookplane/provider/harness'

const apiKey = process.env['STRIPE_API_KEY']!

describe.skip('CRUD Round Trip: Stripe', async () => {
    const Stripe = await createStripeProvider({
        apiKey,
        webhookSecret: 'TODO',
    })

    crudRoundTrip(
        Stripe._unsafeUnwrap(),
        {
            name: 'Event Name',
            eventPayload: 'snapshot',
        },
        true,
    )
})
