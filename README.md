# Hookplane

> **Alpha**: This library is in active development.
>
> Features may not work as expected. APIs may change.

Receive events with one line of code.

```typescript
import { hookplane } from '@/lib/hookplane'

const paymentIntentFailed = hookplane.subscribe(
    'stripe',
    'payment_intent.payment_failed',
)

export default function handler(request: Request) {
    const event = paymentIntentFailed(request)
    console.log('Payment Intent Failed: ', event.id) // Type safe!
}
```
