import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createLocalBackend } from '~/local.js'
import { ProviderNotFoundError } from '~/backend.js'
import {
    ProviderSet,
    Provider,
    EventDefinition,
    EndpointHandle,
    createEndpointHandle,
    createEndpointUrl,
    State,
} from '@hookplane/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

function createFakeProvider(name: string, events: string[]): Provider {
    const eventsRecord = {} as Record<string, EventDefinition<unknown>>
    for (const eventName of events) {
        eventsRecord[eventName] = {
            __phantom: undefined,
        } as EventDefinition<unknown>
    }
    return {
        name,
        config: {},
        state: null,
        events: eventsRecord,
        setup: () => {
            throw new Error('not implemented')
        },
        createEndpoint: () => {
            throw new Error('not implemented')
        },
        readEndpoint: () => {
            throw new Error('not implemented')
        },
        updateEndpoint: () => {
            throw new Error('not implemented')
        },
        deleteEndpoint: () => {
            throw new Error('not implemented')
        },
        indexEndpoints: () => {
            throw new Error('not implemented')
        },
    }
}

function createFakeStatefileData(
    providerName: string,
    handle: string,
    url: string,
    events: string[],
) {
    return {
        version: 1,
        providerStates: {
            [providerName]: {
                [handle]: {
                    state: {
                        url,
                        events,
                        config: {},
                    },
                },
            },
        },
    }
}

describe('createLocalBackend', () => {
    let tmpDir: string
    let statefilePath: string
    let signingSecretPath: string

    const fakeProviderName = 'stripe'
    const fakeEvents = ['payment.succeeded', 'payment.failed']
    const fakeHandle = createEndpointHandle('endpoint-1')._unsafeUnwrap()
    const fakeUrl = createEndpointUrl(
        'https://example.com/webhook',
    )._unsafeUnwrap()

    const fakeProvider = createFakeProvider(fakeProviderName, fakeEvents)
    const fakeProviders: ProviderSet = { [fakeProviderName]: fakeProvider }

    const mockStatefileData = createFakeStatefileData(
        fakeProviderName,
        fakeHandle,
        fakeUrl,
        fakeEvents,
    )

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hookplane-test-'))
        statefilePath = path.join(tmpDir, 'statefile.json')
        signingSecretPath = path.join(tmpDir, 'secrets.json')
    })

    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    const createDriver = async () => {
        const makeBackend = createLocalBackend({
            statefilePath,
            signingSecretPath,
        })
        return makeBackend()
    }

    describe('state.read', () => {
        it('returns ok with parsed data when file exists', async () => {
            await fs.writeFile(
                statefilePath,
                JSON.stringify(mockStatefileData),
                'utf-8',
            )

            const driver = await createDriver()
            const result = await driver.state.read(fakeProviders)

            expect(result.isOk()).toBe(true)
            const state = result._unsafeUnwrap()
            expect(state.providerStates[fakeProviderName]).toBeDefined()
            const providerState = state.providerStates[fakeProviderName]!
            expect(providerState.has(fakeHandle)).toBe(true)
        })

        it('returns NotFoundError when file does not exist', async () => {
            const driver = await createLocalBackend({
                statefilePath: path.join(tmpDir, 'doesnotexist.json'),
                signingSecretPath,
            })()
            const result = await driver.state.read(fakeProviders)

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('NotFoundError')
            expect(result._unsafeUnwrapErr().while).toBe('read')
        })

        it('returns InternalError when file contains invalid json', async () => {
            await fs.writeFile(statefilePath, 'not valid json', 'utf-8')

            const driver = await createDriver()
            const result = await driver.state.read(fakeProviders)

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('InternalError')
            expect(result._unsafeUnwrapErr().while).toBe('read')
        })

        it('returns ProviderNotFoundError when statefile references unknown provider', async () => {
            const badData = createFakeStatefileData(
                'unknown-provider',
                fakeHandle,
                fakeUrl,
                fakeEvents,
            )
            await fs.writeFile(statefilePath, JSON.stringify(badData), 'utf-8')

            const driver = await createDriver()
            const result = await driver.state.read(fakeProviders)

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('ProviderNotFoundError')
            expect(
                (result._unsafeUnwrapErr() as ProviderNotFoundError).provider,
            ).toBe('unknown-provider')
        })
    })

    describe('state.write', () => {
        it('creates file with json data', async () => {
            const endpointState = {
                url: fakeUrl,
                events: fakeEvents,
                config: {},
            }
            const providerState = new Map<EndpointHandle, typeof endpointState>(
                [[fakeHandle, endpointState]],
            )
            const state: State<ProviderSet> = {
                providers: fakeProviders,
                providerStates: {
                    [fakeProviderName]: providerState,
                },
            }

            const driver = await createDriver()
            const result = await driver.state.write(state)

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(statefilePath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed.version).toBe(1)
            expect(parsed.providerStates[fakeProviderName]).toBeDefined()
            expect(
                parsed.providerStates[fakeProviderName][fakeHandle],
            ).toBeDefined()
        })

        it('roundtrips data through write and read', async () => {
            const endpointState = {
                url: fakeUrl,
                events: fakeEvents,
                config: {},
            }
            const providerState = new Map<EndpointHandle, typeof endpointState>(
                [[fakeHandle, endpointState]],
            )
            const state: State<ProviderSet> = {
                providers: fakeProviders,
                providerStates: {
                    [fakeProviderName]: providerState,
                },
            }

            const driver = await createDriver()
            await driver.state.write(state)

            const result = await driver.state.read(fakeProviders)
            expect(result.isOk()).toBe(true)

            const loadedState = result._unsafeUnwrap()
            expect(loadedState.providerStates[fakeProviderName]).toBeDefined()
            const loadedProviderState =
                loadedState.providerStates[fakeProviderName]!
            expect(loadedProviderState.has(fakeHandle)).toBe(true)

            const loadedEndpoint = loadedProviderState.get(fakeHandle)!
            expect(loadedEndpoint.url).toBe(fakeUrl)
            expect(loadedEndpoint.events).toEqual(fakeEvents)
        })
    })

    describe('state.delete', () => {
        it('removes existing file', async () => {
            await fs.writeFile(statefilePath, '{}', 'utf-8')

            const driver = await createDriver()
            const result = await driver.state.delete()

            expect(result.isOk()).toBe(true)

            const exists = await fs.access(statefilePath).then(
                () => true,
                () => false,
            )
            expect(exists).toBe(false)
        })

        it('returns ok when file does not exist (idempotent delete)', async () => {
            const driver = await createDriver()
            const result = await driver.state.delete()

            expect(result.isOk()).toBe(true)
        })
    })

    describe('signingSecret.read', () => {
        beforeEach(async () => {
            await fs.writeFile(
                signingSecretPath,
                JSON.stringify({ data: {} }),
                'utf-8',
            )
        })

        afterEach(async () => {
            await fs.unlink(signingSecretPath).catch(() => {})
        })

        it('returns ok with secret when id exists', async () => {
            await fs.writeFile(
                signingSecretPath,
                JSON.stringify({ data: { 'secret-1': 'whsec_test123' } }),
                'utf-8',
            )

            const driver = await createDriver()
            const result = await driver.signingSecret.read('secret-1')

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toBe('whsec_test123')
        })

        it('returns NotFoundError when secrets file does not exist', async () => {
            await fs.unlink(signingSecretPath)

            const driver = await createDriver()
            const result = await driver.signingSecret.read('secret-1')

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('NotFoundError')
        })
    })

    describe('signingSecret.write', () => {
        afterEach(async () => {
            await fs.unlink(signingSecretPath).catch(() => {})
        })

        it('creates secrets file with new secret', async () => {
            const driver = await createDriver()
            const result = await driver.signingSecret.write(
                'secret-1',
                'whsec_test123',
            )

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(signingSecretPath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual({ data: { 'secret-1': 'whsec_test123' } })
        })

        it('overwrites existing secret', async () => {
            await fs.writeFile(
                signingSecretPath,
                JSON.stringify({ data: { 'secret-1': 'whsec_old' } }),
                'utf-8',
            )

            const driver = await createDriver()
            const result = await driver.signingSecret.write(
                'secret-1',
                'whsec_new',
            )

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(signingSecretPath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual({ data: { 'secret-1': 'whsec_new' } })
        })

        it('adds new secret alongside existing ones', async () => {
            await fs.writeFile(
                signingSecretPath,
                JSON.stringify({ data: { 'secret-1': 'whsec_first' } }),
                'utf-8',
            )

            const driver = await createDriver()
            const result = await driver.signingSecret.write(
                'secret-2',
                'whsec_second',
            )

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(signingSecretPath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual({
                data: {
                    'secret-1': 'whsec_first',
                    'secret-2': 'whsec_second',
                },
            })
        })
    })

    describe('signingSecret.delete', () => {
        afterEach(async () => {
            await fs.unlink(signingSecretPath).catch(() => {})
        })

        it('removes existing secret', async () => {
            await fs.writeFile(
                signingSecretPath,
                JSON.stringify({
                    data: {
                        'secret-1': 'whsec_test',
                        'secret-2': 'whsec_other',
                    },
                }),
                'utf-8',
            )

            const driver = await createDriver()
            const result = await driver.signingSecret.delete('secret-1')

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(signingSecretPath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual({ data: { 'secret-2': 'whsec_other' } })
        })

        it('returns ok when secret does not exist (idempotent delete)', async () => {
            await fs.writeFile(
                signingSecretPath,
                JSON.stringify({ data: { 'other-secret': 'whsec_abc' } }),
                'utf-8',
            )

            const driver = await createDriver()
            const result = await driver.signingSecret.delete('secret-1')

            expect(result.isOk()).toBe(true)
        })
    })

    describe('driver identity', () => {
        it('has correct name', async () => {
            const driver = await createDriver()
            expect(driver.name).toBe('local-file')
        })
    })
})
