import hp from '../hookplane'

export const checkoutCompleted = hp.subscribe(
    '/hooks',
    'stripe',
    'checkout.session.completed',
)
