import { Result, ok, err } from 'neverthrow'
import { randomUUID } from 'crypto'

const PREFIX_UNKNOWN: string = '___UNKNOWN___'
const PREFIX_ORPHAN: string = '___ORPHAN___'

/**
 * Represents a provider-side id keying a provider-registered endpoint.
 */
export type EndpointHandle = EndpointHandleReal | EndpointHandleOrphan

/**
 * An endpoint handle that corresponds to an endpoint currently registered with a provider.
 * @see `EndpointHandleUnknown`
 * @see `EndpointHandleOrphan`
 */
export type EndpointHandleReal = string & { __brand: 'EndpointHandleReal' }

/**
 * An endpoint handle that may correspond to a real endpoint or an orphan (yet to be registered).
 * @see `EndpointHandleReal`
 * @see `EndpointHandleOrphan`
 */
export type EndpointHandleUnknown = string & {
    __brand: 'EndpointHandleUnknown'
}

/**
 * An endpoint handle that corresponds to an endpoint yet to be registered/not registered with a provider.
 * @see `EndpointHandleReal`
 * @see `EndpointHandleUnknown`
 */
export type EndpointHandleOrphan = string & { __brand: 'EndpointHandleOrphan' }

/**
 * Error returned when an endpoint handle is invalid.
 */
export interface InvalidEndpointHandleError extends Error {
    name: 'InvalidEndpointHandleError'
    message: string
}

/**
 * Creates a real EndpointHandle from a string.
 *
 * @param handle - The handle string
 * @returns A real endpoint handle.
 */
export function createRealEndpointHandle(
    handle: string,
): Result<EndpointHandleReal, InvalidEndpointHandleError> {
    if (handle.length === 0) {
        return err({
            name: 'InvalidEndpointHandleError',
            message: 'endpoint handle cannot be empty',
        } satisfies InvalidEndpointHandleError)
    } else if (endpointHandleIsOrphan(handle as EndpointHandle)) {
        return err({
            name: 'InvalidEndpointHandleError',
            message:
                'attempted to create a real endpoint handle from an orphan endpoint handle',
        } satisfies InvalidEndpointHandleError)
    }
    return ok(handle as EndpointHandleReal)
}

/**
 * Creates an orphan endpoint handle.
 * @returns An orphan endpoint handle
 */
export function createUnknownEndpointHandle(): EndpointHandleUnknown {
    const uuid = randomUUID()
    const handle = PREFIX_UNKNOWN + uuid

    return handle as EndpointHandleUnknown
}

export function endpointHandleIsUnknown(handle: EndpointHandle): boolean {
    return handle.startsWith(PREFIX_UNKNOWN)
}

/**
 * Creates an orphan endpoint handle.
 * @returns An orphan endpoint handle
 */
export function createOrphanEndpointHandle(): EndpointHandleOrphan {
    const uuid = randomUUID()
    const handle = PREFIX_ORPHAN + uuid

    return handle as EndpointHandleOrphan
}

export function endpointHandleIsOrphan(handle: EndpointHandle): boolean {
    return handle.startsWith(PREFIX_ORPHAN)
}

/**
 * Downcasts an endpoint handle, validating that it is real.
 * @param handle The endpoint handle
 * @returns The endpoint handle as real if real, else undefined
 */
export function downcastEndpointHandle(
    handle: EndpointHandle,
): EndpointHandleReal | undefined {
    if (endpointHandleIsOrphan(handle)) {
        return undefined
    }

    return handle as EndpointHandleReal
}
