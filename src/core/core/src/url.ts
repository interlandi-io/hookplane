import { err, ok, Result } from 'neverthrow'

/**
 * The full URL of an endpoint.
 */
export type EndpointUrl = string & { __brand: 'endpointUrl' }

/**
 * Error returned when an endpoint URL is invalid.
 */
export interface InvalidEndpointUrlError extends Error {
    name: 'InvalidEndpointUrlError'
    message: string
    cause?: Error
}

/**
 * Creates an EndpointUrl from a string.
 *
 * @param url - The URL string
 * @returns Ok with EndpointUrl if valid http/https URL, Err otherwise
 */
export function createEndpointUrl(
    url: string,
): Result<EndpointUrl, InvalidEndpointUrlError> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return err({
            name: 'InvalidEndpointUrlError',
            message: `URL does not start with protocol: ${url}`,
        } satisfies InvalidEndpointUrlError)
    }

    try {
        new URL(url)
    } catch (e) {
        return err({
            name: 'InvalidEndpointUrlError',
            message:
                e instanceof Error
                    ? `${url} is invalid: ${e.message}`
                    : `invalid endpoint URL: ${url}`,
            cause: e instanceof Error ? e : undefined,
        } satisfies InvalidEndpointUrlError)
    }

    return ok(url as EndpointUrl)
}
