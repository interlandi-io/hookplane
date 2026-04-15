import { describe, it, expect } from 'vitest'
import { createEndpointUrl, type EndpointUrl } from '~/url.js'

describe('url', () => {
    describe('createEndpointUrl', () => {
        it('returns ok with EndpointUrl for valid https URL', () => {
            const result = createEndpointUrl('https://example.com')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('https://example.com')
        })

        it('returns ok with EndpointUrl for valid http URL', () => {
            const result = createEndpointUrl('http://localhost:3000')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('http://localhost:3000')
        })

        it('returns ok for URL with path', () => {
            const result = createEndpointUrl('https://example.com/webhook')
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('https://example.com/webhook')
        })

        it('returns ok for URL with nested path', () => {
            const result = createEndpointUrl(
                'https://example.com/api/v1/webhook',
            )
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe(
                'https://example.com/api/v1/webhook',
            )
        })

        it('returns err for URL without protocol', () => {
            const result = createEndpointUrl('example.com')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe(
                'InvalidEndpointUrlError',
            )
        })

        it('returns err for invalid URL', () => {
            const result = createEndpointUrl('not-a-url')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe(
                'InvalidEndpointUrlError',
            )
        })

        it('returns err for empty string', () => {
            const result = createEndpointUrl('')
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe(
                'InvalidEndpointUrlError',
            )
        })
    })
})
