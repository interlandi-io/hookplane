import { it, expect } from 'vitest'
import {
    Provider,
    EndpointHandle,
    createBaseUrl,
    createEndpointUrl,
    createRelativeUrl,
    EndpointConfigOf,
} from '@hookplane/core'

export async function crudRoundTrip<
    P extends Provider<string, unknown, C, unknown>,
    C,
>(
    getProvider: () => Promise<Provider<string, unknown, C, unknown>>,
    testConfig: EndpointConfigOf<P>,
) {
    // Use a getter so errors propagate
    const provider = await getProvider()

    let createdHandle: EndpointHandle

    const testBaseUrl = createBaseUrl('https://example.com')._unsafeUnwrap()
    const testRelativeUrl = createRelativeUrl('/webhook')._unsafeUnwrap()
    const testEndpointUrl = createEndpointUrl(
        testBaseUrl,
        testRelativeUrl,
    )._unsafeUnwrap()
    const testEvents = Array.from(Object.keys(provider.events))

    const updatedRelativeUrl =
        createRelativeUrl('/updated-webhook')._unsafeUnwrap()
    const updatedEndpointUrl = createEndpointUrl(
        testBaseUrl,
        updatedRelativeUrl,
    )._unsafeUnwrap()

    it('0) Delete all existing endpoints', async () => {
        const indexResult = await provider.indexEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
        expect(indexResult.isOk()).toBe(true)
        const index = indexResult._unsafeUnwrap()

        for (const [handle] of index.entries()) {
            const deleteResult = await provider.deleteEndpoint({
                providerState: provider.state,
                providerConfig: provider.config,
                handle,
            })
            expect(deleteResult.isOk()).toBe(true)
        }
    })

    it('1) Returns empty index', async () => {
        const indexResult = await provider.indexEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
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
        expect(createResult.isOk()).toBe(true)
        const handle = createResult._unsafeUnwrap().handle
        createdHandle = handle
    })

    it('3) Index returns a single endpoint', async () => {
        const indexResult = await provider.indexEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
        expect(indexResult.isOk()).toBe(true)
        const index = indexResult._unsafeUnwrap()

        expect(index.size).toBe(1)
        const entries = Array.from(index.entries())
        const firstEntry = entries[0]!
        const [, state] = firstEntry

        expect(testRelativeUrl).toBe(state.relativeUrl)
        // expect(testEvents).toEqual(state.events)
        expect(testConfig).toEqual(state.config)
    })

    it('4) Reads the existing endpoint correctly', async () => {
        const readResult = await provider.readEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
        })
        expect(readResult.isOk()).toBe(true)
        const state = readResult._unsafeUnwrap()
        expect(testRelativeUrl).toBe(state.relativeUrl)
        // expect(testEvents).toEqual(state.events) // TODO maybe the most frustrating case of vitest bullshit ever
        expect(testConfig).toEqual(state.config)
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
        expect(updateResult.isOk()).toBe(true)
    })

    it('6) Reads the updated endpoint correctly', async () => {
        const readResult = await provider.readEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
        })
        expect(readResult.isOk()).toBe(true)
        const state = readResult._unsafeUnwrap()
        expect(updatedRelativeUrl).toBe(state.relativeUrl)
        expect(testEvents).toEqual(state.events)
        expect(testConfig).toEqual(state.config)
    })

    it('7) Deletes the endpoint', async () => {
        const deleteResult = await provider.deleteEndpoint({
            providerState: provider.state,
            providerConfig: provider.config,
            handle: createdHandle,
        })
        expect(deleteResult.isOk()).toBe(true)
    })

    it('8) Index returns an empty state again', async () => {
        const indexResult = await provider.indexEndpoints({
            providerState: provider.state,
            providerConfig: provider.config,
        })
        expect(indexResult.isOk()).toBe(true)
        const index = indexResult._unsafeUnwrap()
        expect(index.size).toBe(0)
    })
}
