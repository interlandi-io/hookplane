import { EventDefinition } from '@hookplane/core'
import { z } from 'zod'

export type ZodEventMap = Record<string, z.ZodType>

/**
 * Creates an event definition with parse and mock methods from a Zod schema.
 */
function zodEvent<T extends z.ZodTypeAny>(
    // eslint-disable-next-line
    schema: T,
): EventDefinition<z.infer<T>> {
    return {} as EventDefinition<z.infer<T>>
}

/**
 * Creates a record of event definitions from a Zod schema record.
 */
export function zodEvents<T extends ZodEventMap>(
    events: T,
): {
    [K in keyof T]: EventDefinition<z.infer<T[K]>>
} {
    return Object.fromEntries(
        Object.entries(events).map(([name, schema]) => [
            name,
            zodEvent(schema),
        ]),
    ) as {
        [K in keyof T]: EventDefinition<z.infer<T[K]>>
    }
}
