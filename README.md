<div align="center">

[![npm](https://img.shields.io/npm/v/hookplane)](https://www.npmjs.com/package/hookplane)
&nbsp;&nbsp;&nbsp;&nbsp;
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/interlandi-io/hookplane/blob/master/LICENSE)

</div>

# Hookplane

Define and manage webhook subscriptions entirely in code.

## Receive webhooks by writing code

```typescript
const hp = await hookplane({
    providers: {
        stripe: {
            provider: await stripeProvider({
                apiKey: process.env['STRIPE_API_KEY']!,
            }),
            endpoint: 'https://example.com/hooks/stripe',
            events: ['checkout.session.completed'],
            endpointConfig: {
                name: 'my_endpoint',
                eventPayload: 'snapshot',
            },
        },
    },
})
```

## Your integrations live in your codebase

Hookplane is 100% declarative.

No more keeping code in sync with dashboards.

Define, manage, and validate webhooks exactly where they’re handled.

## Agents love it

Hookplane has end-to-end type safety so, LLMs can safely:

- add new webhook subscriptions
- update event handlers
- reason about real schemas

No MCP required.

## Getting Started

Install `hookplane` and the Stripe provider through your favorite package manager.

```bash
npm install hookplane @hookplane/stripe
```

Create a `hookplane.ts` file anywhere you would otherwise keep your source files.

Replace `<YOUR_ENDPOINT>` with any URL you'd like.

```typescript
// ./src/hookplane.ts
import { hookplane } from 'hookplane'
import { stripeProvider } from '@hookplane/stripe'

const hp = await hookplane({
    providers: {
        stripe: {
            provider: await stripeProvider({
                apiKey: process.env['STRIPE_API_KEY']!,
            }),
            endpoint: '<YOUR_ENDPONT>',
            events: ['checkout.session.completed'],
            endpointConfig: {
                name: 'my_endpoint',
                eventPayload: 'snapshot',
            },
        },
    },
})

export default hp
```

Add an env file (or inject environment variables however you normally do)

```bash
echo STRIPE_API_KEY=<YOUR-STRIPE-API-KEY> >> .env.local
```

Try out the `hp` command.

```bash
npx hp plan
```

Push your changes with the `--bootstrap` flag, since this is your first push.

```bash
npx hp push --bootstrap
```

Go look at your Stripe dashboard.

You're subscribed to `'checkout.session.completed'`.

---

> **Alpha**: This library is in active development.
>
> Features may not work as expected. APIs may change.
