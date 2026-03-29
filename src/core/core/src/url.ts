import { err, ok, Result } from 'neverthrow'
import { type EndpointState, type Provider } from './provider'

/**
 * A branded string for endpoint handles.
 */
export type EndpointHandle = string & { __brand: 'EndpointHandle' }

/**
 * Represents an a subscription yet to be created.
 */
export const ENDPOINT_HANDLE_ORPHAN = '___ORPHAN___' as EndpointHandle

/**
 * The full URL of an endpoint (base URL + relative URL).
 */
export type EndpointUrl = string & { __brand: 'endpointUrl' }

/**
 * Error types for URL operations.
 */
export type UrlError =
    | InvalidBaseUrlError
    | InvalidRelativeUrlError
    | InvalidEndpointHandleError

/**
 * Error returned when a base URL is invalid.
 */
export interface InvalidBaseUrlError extends Error {
    name: 'InvalidBaseUrlError'
    message: `invalid base URL: ${string}`
    source?: Error
}

/**
 * Error returned when a relative URL is invalid.
 */
export interface InvalidRelativeUrlError extends Error {
    name: 'InvalidRelativeUrlError'
    message: `relative URL must start with "/": ${string}`
}

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

/**
 * Creates a BaseUrl from a string.
 *
 * @param url - The URL string
 * @returns Ok with BaseUrl if valid http/https URL, Err otherwise
 */
export function createBaseUrl(
    url: string,
): Result<string & { __brand: 'baseUrl' }, InvalidBaseUrlError> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return err({
            name: 'InvalidBaseUrlError',
            message: `invalid base URL: ${url}`,
        } satisfies InvalidBaseUrlError)
    }

    try {
        new URL(url)
    } catch {
        return err({
            name: 'InvalidBaseUrlError',
            message: `invalid base URL: ${url}`,
        } satisfies InvalidBaseUrlError)
    }

    return ok(url as string & { __brand: 'baseUrl' })
}

/**
 * A branded string for base URLs.
 */
export type BaseUrl = string & { __brand: 'baseUrl' }

/**
 * A branded string for relative URLs.
 */
export type RelativeUrl = string & { __brand: 'relativeUrl' }

/**
 * Creates a RelativeUrl from a string.
 *
 * @param url - The relative URL string
 * @returns Ok with RelativeUrl if starts with "/", Err otherwise
 */
export function createRelativeUrl(
    url: string,
): Result<RelativeUrl, InvalidRelativeUrlError> {
    if (!url.startsWith('/')) {
        return err({
            name: 'InvalidRelativeUrlError',
            message: `relative URL must start with "/": ${url}`,
        } satisfies InvalidRelativeUrlError)
    }

    return ok(url as RelativeUrl)
}

/**
 * Creates an EndpointUrl by combining a BaseUrl and RelativeUrl.
 *
 * @param base - The base URL
 * @param rel - The relative URL (optional, defaults to "/")
 * @returns Ok with EndpointUrl if inputs are valid, Err otherwise
 */
export function createEndpointUrl(
    base: BaseUrl,
    rel?: RelativeUrl,
): Result<EndpointUrl, InvalidBaseUrlError> {
    const relative = rel ?? ('/' as RelativeUrl)

    try {
        const url = new URL(relative, base).toString()
        return ok(url as EndpointUrl)
    } catch (e) {
        return err({
            name: 'InvalidBaseUrlError',
            message: `invalid base URL: ${base}`,
            source: typeof e === 'object' ? (e as Error) : undefined,
        } satisfies InvalidBaseUrlError)
    }
}

/**
 * Composes an EndpointUrl from a BaseUrl and EndpointState.
 *
 * @param baseUrl - The base URL
 * @param endpoint - The endpoint state containing relativeUrl
 * @returns Ok with EndpointUrl
 */
export function composeEndpointUrl(
    baseUrl: BaseUrl,
    endpoint: EndpointState<Provider>,
): EndpointUrl {
    return createEndpointUrl(baseUrl, endpoint.relativeUrl)._unsafeUnwrap()
}
