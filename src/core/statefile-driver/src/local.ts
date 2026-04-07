import {
    describeStatefileDriver,
    type StatefileOperation,
    type StatefileDriverError,
    type StatefileDriverData,
    NotFoundError,
    PermissionDeniedError,
    WriteRejectedError,
    UnknownError,
} from './statefile-driver.js'
import { Statefile, ProviderSet } from '@hookplane/core'
import { ResultAsync } from 'neverthrow'
import { readFile, writeFile, unlink } from 'node:fs/promises'

export type LocalFileDriverConfig = {
    path: string
}

function toStatefileDriverError(
    e: unknown,
    operation: StatefileOperation,
    path: string,
): StatefileDriverError {
    const error = e as NodeJS.ErrnoException & { kind?: string }
    if (error.kind && error.kind === 'StatefileDriverError') {
        return error as StatefileDriverError
    }
    if (error.code === 'ENOENT') {
        return {
            kind: 'StatefileDriverError',
            name: 'NotFoundError',
            message: `file not found: ${path}`,
            while: operation,
        } satisfies NotFoundError
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
            kind: 'StatefileDriverError',
            name: 'PermissionDeniedError',
            message: `permission denied: ${path}`,
            while: operation,
        } satisfies PermissionDeniedError
    }
    if (error.code === 'ENOSPC') {
        return {
            kind: 'StatefileDriverError',
            name: 'WriteRejectedError',
            message: 'disk full',
            while: operation,
        } satisfies WriteRejectedError
    }
    return {
        kind: 'StatefileDriverError',
        name: 'UnknownError',
        message: String(e),
        while: operation,
        cause: e,
    } satisfies UnknownError
}

async function readStatefile(
    config: LocalFileDriverConfig,
): Promise<StatefileDriverData> {
    const contents = await readFile(config.path, 'utf-8')
    return JSON.parse(contents)
}

async function writeStatefile<P extends ProviderSet>(
    config: LocalFileDriverConfig,
    data: Statefile<P>,
): Promise<void> {
    await writeFile(config.path, JSON.stringify(data.data, null, 2), 'utf-8')
}

async function deleteStatefile(config: LocalFileDriverConfig): Promise<void> {
    try {
        await unlink(config.path)
    } catch (e) {
        const error = e as NodeJS.ErrnoException
        if (error.code !== 'ENOENT') {
            throw e
        }
    }
}

export const createLocalFileDriver = describeStatefileDriver<
    LocalFileDriverConfig
>({
    name: 'local-file',
    read: ({ config }) =>
        ResultAsync.fromPromise(readStatefile(config), (e) =>
            toStatefileDriverError(e, 'read', config.path),
        ),
    write: ({ config, data }) =>
        ResultAsync.fromPromise(writeStatefile(config, data), (e) =>
            toStatefileDriverError(e, 'write', config.path),
        ),
    delete: ({ config }) =>
        ResultAsync.fromPromise(deleteStatefile(config), (e) =>
            toStatefileDriverError(e, 'delete', config.path),
        ),
})
