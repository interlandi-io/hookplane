import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { logger } from '../logger.js'

export function loadEnv(envFile?: string) {
    const paths = envFile
        ? [resolve(envFile)]
        : [resolve('.env'), resolve('.env.local')]

    for (const path of paths) {
        if (existsSync(path)) {
            config({
                path,
                quiet: true,
            })
            logger.debug(`Loaded env from ${path}`)
            return
        }
    }

    if (!envFile) {
        logger.warn(`Env file not found: ${envFile}`)
    }
}
