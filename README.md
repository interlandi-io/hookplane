# Hookplane

Define and manage webhooks entirely in code.

Built for the LLM era.

## Receive webhooks with one line of code.

```typescript
hookplane.subscribe('hubspot', 'ticket.creation')
```

## Your integrations live in your codebase.

Hookplane is stateless and 100% declarative.

No more keeping code in sync with dashboards.

Define, manage, and validate webhooks exactly where they’re handled.

## Built for agents, not just humans

With end-to-end type-safety, LLMs can safely:
- add new webhook subscriptions
- update event handlers
- reason about real schemas.

No MCP required.

## Framework-native

This isn't Terraform, it's:

```typescript
// In a next.js app:
// app/hooks/handler.ts

import { hookplane } from '@/lib/hookplane'

const paymentFailed = hookplane.subscribe('stripe') // route inferred

export default function handler(request: Request) {
    const event = hookplane.parse(request, paymentFailed)
    console.log('Payment Intent Failed: ', event.data.id) // 100% type safe
}
```

---

> **Alpha**: This library is in active development.
>
> Features may not work as expected. APIs may change.
