# Hookplane

## Receive webhooks with one line of code.

```typescript
hookplane.subscribe('hubspot', 'ticket.creation')
```

## One Declarative Source of Truth

Hookplane has no dashboard.

Instead of dancing between Zapier, your Terraform config, and your Stripe dashboard,
you &mdash; or your agents &mdash;
subscribe to a webhook right in the code that consumes it.


## Framework-Native Tooling

```typescript
// In a next.js app:
// app/hooks/handler.ts

import { hookplane } from '@/lib/hookplane'

const paymentFailed = hookplane.subscribe('stripe') // route inferred

export default function handler(request: Request) {
    const event = hookplane.parse(request, paymentFailed)

    if (event.type == 'payment_intent.payment_failed') { // autocompleted
        console.log('Payment Intent Failed: ', event.data.id) // 100% type safe
    }
}
```

---

> **Alpha**: This library is in active development.
>
> Features may not work as expected. APIs may change.
