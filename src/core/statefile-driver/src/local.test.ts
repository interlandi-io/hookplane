import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createLocalFileDriver } from '~/local.js'
import { StatefileDriverData } from '~/statefile-driver.js'
import {
    createBaseUrl,
    createEndpointHandle,
    createRelativeUrl,
} from '@hookplane/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('createLocalFileDriver', () => {
    let tmpDir: string

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'statefile-driver-test-'),
        )
    })

    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    const mockData: StatefileDriverData = {
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
                    signingSecret: 'secret123',
                },
            },
        },
    }

    describe('read', () => {
        it('returns ok with parsed data when file exists', async () => {
            const filePath = path.join(tmpDir, 'state.json')
            await fs.writeFile(filePath, JSON.stringify(mockData), 'utf-8')

            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.read()

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap()).toEqual(mockData)
        })

        it('returns NotFoundError when file does not exist', async () => {
            const filePath = path.join(tmpDir, 'nonexistent.json')
            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.read()

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('NotFoundError')
            expect(result._unsafeUnwrapErr().while).toBe('read')
        })

        it('returns UnknownError when file contains invalid json', async () => {
            const filePath = path.join(tmpDir, 'invalid.json')
            await fs.writeFile(filePath, 'not valid json', 'utf-8')

            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.read()

            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('UnknownError')
            expect(result._unsafeUnwrapErr().while).toBe('read')
        })
    })

    describe('write', () => {
        it('creates file with json data', async () => {
            const filePath = path.join(tmpDir, 'write-test.json')
            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.write(mockData)

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(filePath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual(mockData)
        })

        it('overwrites existing file', async () => {
            const filePath = path.join(tmpDir, 'overwrite.json')
            await fs.writeFile(filePath, '{"old": "data"}', 'utf-8')

            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.write(mockData)

            expect(result.isOk()).toBe(true)

            const contents = await fs.readFile(filePath, 'utf-8')
            const parsed = JSON.parse(contents)
            expect(parsed).toEqual(mockData)
        })
    })

    describe('delete', () => {
        it('removes existing file', async () => {
            const filePath = path.join(tmpDir, 'delete-me.json')
            await fs.writeFile(filePath, '{}', 'utf-8')

            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.delete()

            expect(result.isOk()).toBe(true)

            const exists = await fs.access(filePath).then(
                () => true,
                () => false,
            )
            expect(exists).toBe(false)
        })

        it('returns ok when file does not exist (idempotent delete)', async () => {
            const filePath = path.join(tmpDir, 'never-existed.json')
            const driver = createLocalFileDriver({ path: filePath })
            const result = await driver.delete()

            expect(result.isOk()).toBe(true)
        })
    })

    describe('driver identity', () => {
        it('has correct name', () => {
            const driver = createLocalFileDriver({
                path: path.join(tmpDir, 'test.json'),
            })
            expect(driver.name).toBe('local-file')
        })
    })
})
