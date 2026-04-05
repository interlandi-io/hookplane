// Just a sketch for now
import { hookplane } from './hookplane'
import { createStripeProvider, createStripeProvider as stripeProvider } from '@hookplane/stripe'

const hp = hookplane({
    providers: {
        // TODO this can't be a result
        stripe: (await stripeProvider({
            apiKey: process.env['STRIPE_API_KEY']!,
        }))._unsafeUnwrap()
    }
})

const checkoutCompleted = hp.subscribe('stripe', 'checkout.session.completed')
