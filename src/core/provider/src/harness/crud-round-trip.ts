import { it, expect } from 'vitest'
import {
    Provider,
    EndpointHandle,
    createBaseUrl,
    createEndpointUrl,
    createRelativeUrl,
    EndpointConfigOf,
} from '@hookplane/core'

export function crudRoundTrip<
    P extends Provider<string, unknown, C, unknown>,
    C,
>(provider: P, testConfig: EndpointConfigOf<P>, logResults: boolean = false) {
    let createdHandle: EndpointHandle

    const testBaseUrl = createBaseUrl('https://example.com')
    const testRelativeUrl = createRelativeUrl('/webhook')
    const testEndpointUrl = createEndpointUrl(testBaseUrl, testRelativeUrl)
    const testEvents = Object.keys(provider.events)

    const updatedRelativeUrl = createRelativeUrl('/updated-webhook')
    const updatedEndpointUrl = createEndpointUrl(
        testBaseUrl,
        updatedRelativeUrl,
    )

    it('1) Returns empty index', async () => {
        const indexResult = await provider.mapEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
        if (logResults) {
            console.log(indexResult)
        }
        expect(indexResult.isOk()).toBe(true)
        const index = indexResult._unsafeUnwrap()
        expect(index.size).toBe(0)
    })

    it('2) Successfully creates', async () => {
        const createResult = await provider.createEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            url: testEndpointUrl,
            events: testEvents,
            endpointConfig: testConfig,
        })
        if (logResults) {
            console.log(createResult)
        }
        expect(createResult.isOk()).toBe(true)
    })

    it('3) Index returns a single endpoint', async () => {
        const indexResult = await provider.mapEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
        if (logResults) {
            console.log(indexResult)
        }
        expect(indexResult.isOk()).toBe(true)
        const index = indexResult._unsafeUnwrap()

        expect(index.size).toBe(1)
        const entries = Array.from(index.entries())
        const firstEntry = entries[0]!
        const [handle, state] = firstEntry

        expect(state.relativeUrl).toBe(testRelativeUrl)
        expect(state.events).toEqual(testEvents)
        expect(state.config).toEqual(testConfig)

        createdHandle = handle
    })

    it('4) Reads the existing endpoint correctly', async () => {
        const readResult = await provider.readEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
        })
        if (logResults) {
            console.log(readResult)
        }
        expect(readResult.isOk()).toBe(true)
        const state = readResult._unsafeUnwrap()
        expect(state.relativeUrl).toBe(testRelativeUrl)
        expect(state.events).toEqual(testEvents)
        expect(state.config).toEqual(testConfig)
    })

    it('5) Updates the endpoint', async () => {
        const updateResult = await provider.updateEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
            url: updatedEndpointUrl,
            events: testEvents,
            endpointConfig: testConfig,
        })
        if (logResults) {
            console.log(updateResult)
        }
        expect(updateResult.isOk()).toBe(true)
    })

    it('6) Reads the updated endpoint correctly', async () => {
        const readResult = await provider.readEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
        })
        if (logResults) {
            console.log(readResult)
        }
        expect(readResult.isOk()).toBe(true)
        const state = readResult._unsafeUnwrap()
        expect(state.relativeUrl).toBe(updatedRelativeUrl)
        expect(state.events).toEqual(testEvents)
        expect(state.config).toEqual(testConfig)
    })

    it('7) Deletes the endpoint', async () => {
        const deleteResult = await provider.deleteEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
        })
        if (logResults) {
            console.log(deleteResult)
        }
        expect(deleteResult.isOk()).toBe(true)
    })

    it('8) Index returns an empty state again', async () => {
        const indexResult = await provider.mapEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
        if (logResults) {
            console.log(indexResult)
        }
        expect(indexResult.isOk()).toBe(true)
        const index = indexResult._unsafeUnwrap()
        expect(index.size).toBe(0)
    })
}
