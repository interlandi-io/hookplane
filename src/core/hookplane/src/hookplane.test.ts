// Just a sketch for now
import { hookplane } from './hookplane.js'
import { stripeProvider } from '@hookplane/stripe'

const hp = await hookplane({
    providers: {
        // TODO this can't be a result
        stripe: stripeProvider({
            apiKey: process.env['STRIPE_API_KEY']!,
        }),
    },
})

// eslint-disable-next-line
const checkoutCompleted = hp.subscribe(
    '/hooks',
    'stripe',
    'checkout.session.completed',
)
