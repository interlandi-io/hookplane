import { describe, it, expect } from 'vitest'
import {
    createBaseUrl,
    createRelativeUrl,
    createEndpointUrl,
    composeEndpointUrl,
    type BaseUrl,
    type RelativeUrl,
} from './url'

describe('url', () => {
    describe('createBaseUrl', () => {
        it('returns ok with BaseUrl for valid https URL', () => {
            const result = createBaseUrl('https://example.com')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('https://example.com')
        })

        it('returns ok with BaseUrl for valid http URL', () => {
            const result = createBaseUrl('http://localhost:3000')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('http://localhost:3000')
        })

        it('returns err for URL without protocol', () => {
            const result = createBaseUrl('example.com')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('InvalidBaseUrlError')
        })

        it('returns err for invalid URL', () => {
            const result = createBaseUrl('not-a-url')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('InvalidBaseUrlError')
        })
    })

    describe('createRelativeUrl', () => {
        it('returns ok with RelativeUrl for path starting with /', () => {
            const result = createRelativeUrl('/webhook')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('/webhook')
        })

        it('returns ok for root path /', () => {
            const result = createRelativeUrl('/')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('/')
        })

        it('returns err for path not starting with /', () => {
            const result = createRelativeUrl('webhook')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe(
                'InvalidRelativeUrlError',
            )
        })

        it('returns err for empty string', () => {
            const result = createRelativeUrl('')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe(
                'InvalidRelativeUrlError',
            )
        })
    })

    describe('createEndpointUrl', () => {
        it('returns ok with combined URL', () => {
            const baseUrl = 'https://example.com' as BaseUrl
            const relativeUrl = '/webhook' as RelativeUrl
            const result = createEndpointUrl(baseUrl, relativeUrl)
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('https://example.com/webhook')
        })

        it('uses / as default when relative URL not provided', () => {
            const baseUrl = 'https://example.com' as BaseUrl
            const result = createEndpointUrl(baseUrl)
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('https://example.com/')
        })

        it('handles nested paths', () => {
            const baseUrl = 'https://example.com' as BaseUrl
            const relativeUrl = '/api/v1/webhook' as RelativeUrl
            const result = createEndpointUrl(baseUrl, relativeUrl)
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe(
                'https://example.com/api/v1/webhook',
            )
        })
    })

    describe('composeEndpointUrl', () => {
        it('returns composed URL from baseUrl and endpoint state', () => {
            const baseUrl = 'https://example.com' as BaseUrl
            const endpointState = {
                relativeUrl: '/webhook' as RelativeUrl,
                events: ['testEvent'],
                config: {},
            }
            const result = composeEndpointUrl(baseUrl, endpointState)
            expect(result).toBe('https://example.com/webhook')
        })
    })
})
