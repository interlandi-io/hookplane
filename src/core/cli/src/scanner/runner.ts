import fs from 'fs/promises'
import path from 'path'
import { hash } from 'crypto'

export type Runner<T> = {
    run(): Promise<void>
    mod(): T | undefined
    err(): Error | undefined
}

export function createRunner<T>(code: string, wd: string): Runner<T> {
    let mod: T | undefined
    let err: Error | undefined
    const tmpfile = path.join(wd, `${hash('sha1', code)}.tmp.ts`)

    return {
        run: async () => {
            await fs.writeFile(tmpfile, code)
            try {
                mod = await import(`${tmpfile}`)
            } catch (e) {
                err = e instanceof Error ? e : new Error(e as string)
            } finally {
                await fs.unlink(tmpfile)
            }
        },
        mod: () => mod,
        err: () => err,
    }
}
