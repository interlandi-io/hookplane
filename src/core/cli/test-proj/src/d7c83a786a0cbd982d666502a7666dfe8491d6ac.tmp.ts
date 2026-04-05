
import { hookplane } from 'hookplane'
import { stripeProvider } from '@hookplane/stripe'

const hp = await hookplane({
    providers: {
        stripe: stripeProvider({
            apiKey: process.env['STRIPE_API_KEY']!,
        }),
    },
})
export default hp

 hp.subscribe(
    '/hooks',
    'stripe',
    'checkout.session.completed',
)
    