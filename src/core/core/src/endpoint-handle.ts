import { Result, ok, err } from 'neverthrow'
import { randomUUID } from 'crypto'

const ORPHAN_PREFIX: string = '___ORPHAN___'

/**
 * A branded string for endpoint handles.
 */
export type EndpointHandle = string & { __brand: 'EndpointHandle' }

/**
 * The full URL of an endpoint (base URL + relative URL).
 */
export type EndpointUrl = string & { __brand: 'endpointUrl' }

/**
 * Error returned when an endpoint handle is invalid.
 */
export interface InvalidEndpointHandleError extends Error {
    name: 'InvalidEndpointHandleError'
    message: 'endpoint handle cannot be empty'
}

/**
 * Creates an EndpointHandle from a string.
 *
 * @param handle - The handle string
 * @returns Ok with EndpointHandle if non-empty, Err otherwise
 */
export function createEndpointHandle(
    handle: string,
): Result<EndpointHandle, InvalidEndpointHandleError> {
    if (handle.length === 0) {
        return err({
            name: 'InvalidEndpointHandleError',
            message: 'endpoint handle cannot be empty',
        } satisfies InvalidEndpointHandleError)
    }
    return ok(handle as EndpointHandle)
}

export function createOrphanEndpointHandle(): EndpointHandle {
    const uuid = randomUUID()
    const handle = ORPHAN_PREFIX + uuid

    return handle as EndpointHandle
}

export function endpointHandleIsOrphan(handle: EndpointHandle): boolean {
    return handle.startsWith(ORPHAN_PREFIX)
}
