import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createLocalBackend } from '~/local.js'
import { StatefileData } from '~/backend.js'
import {
    Statefile,
    ProviderSet,
    createBaseUrl,
    createEndpointHandle,
    createRelativeUrl,
} from '@hookplane/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('createLocalBackend', () => {
    let tmpDir: string
    let signingSecretPath: string

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'statefile-driver-test-'),
        )
        signingSecretPath = path.join(tmpDir, 'secrets.json')
    })

    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    const createDriver = (
        statefilePath?: string,
    ): ReturnType<typeof createLocalBackend> =>
        createLocalBackend({
            statefilePath: statefilePath || path.join(tmpDir, 'state.json'),
            signingSecretPath,
        })

    const mockData: StatefileData = {
        version: 1,
        baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
        providerStates: {
            stripe: {
                [createEndpointHandle('endpoint-1')._unsafeUnwrap()]: {
                    state: {
                        relativeUrl:
                            createRelativeUrl('/webhook')._unsafeUnwrap(),
                        events: ['payment.succeeded'],
                        config: {},
                    },
                },
            },
        },
    }

    const mockStatefile: Statefile<ProviderSet> = {
        data: mockData,
        toState: () => {
            throw new Error('Not implemented in test')
        },
    }

    describe('statefile.read', () => {
        it('returns ok with parsed data when file exists', async () => {
            const filePath = path.join(tmpDir, 'state.json')
            await fs.writeFile(filePath, JSON.stringify(mockData), 'utf-8')

            const driver = await createDriver(filePath)
            const result = await driver.statefile.read()

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toEqual(mockData)
        })

        it('returns NotFoundError when file does not exist', async () => {
            const filePath = path.join(tmpDir, 'nonexistent.json')
            const driver = await createDriver(filePath)
            const result = await driver.statefile.read()

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('NotFoundError')
            expect(result._unsafeUnwrapErr().while).toBe('read')
        })

        it('returns UnknownError when file contains invalid json', async () => {
            const filePath = path.join(tmpDir, 'invalid.json')
            await fs.writeFile(filePath, 'not valid json', 'utf-8')

            const driver = await createDriver(filePath)
            const result = await driver.statefile.read()

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('UnknownError')
            expect(result._unsafeUnwrapErr().while).toBe('read')
        })
    })

    describe('statefile.write', () => {
        it('creates file with json data', async () => {
            const filePath = path.join(tmpDir, 'write-test.json')
            const driver = await createDriver(filePath)
            const result = await driver.statefile.write(mockStatefile)

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(filePath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual(mockData)
        })

        it('overwrites existing file', async () => {
            const filePath = path.join(tmpDir, 'overwrite.json')
            await fs.writeFile(filePath, '{"old": "data"}', 'utf-8')

            const driver = await createDriver(filePath)
            const result = await driver.statefile.write(mockStatefile)

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(filePath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual(mockData)
        })
    })

    describe('statefile.delete', () => {
        it('removes existing file', async () => {
            const filePath = path.join(tmpDir, 'delete-me.json')
            await fs.writeFile(filePath, '{}', 'utf-8')

            const driver = await createDriver(filePath)
            const result = await driver.statefile.delete()

            expect(result.isOk()).toBe(true)

            const exists = await fs.access(filePath).then(
                () => true,
                () => false,
            )
            expect(exists).toBe(false)
        })

        it('returns ok when file does not exist (idempotent delete)', async () => {
            const filePath = path.join(tmpDir, 'never-existed.json')
            const driver = await createDriver(filePath)
            const result = await driver.statefile.delete()

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
