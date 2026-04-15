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
    message: `invalid endpoint URL: ${string}`
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
            message: `invalid endpoint URL: ${url}`,
        } satisfies InvalidEndpointUrlError)
    }

    try {
        new URL(url)
    } catch {
        return err({
            name: 'InvalidEndpointUrlError',
            message: `invalid endpoint URL: ${url}`,
        } satisfies InvalidEndpointUrlError)
    }

    return ok(url as EndpointUrl)
}
