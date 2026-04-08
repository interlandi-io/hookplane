import { defaultDispatch, parallelExecution, relativeUrlHeuristic } from "@hookplane/core";
import { createOrchestrator } from "./index.js";
import { createLocalFileDriver } from "@hookplane/statefile-driver";
import path from "path";

describe('orchestrator', () => {
    it('runs', async () => {
        const orchestrator = createOrchestrator({
            tsconfigPath: path.resolve(__dirname, '../test-proj/tsconfig.json'),
            execute: parallelExecution(),
            dispatch: defaultDispatch(),
            statefileDriver: createLocalFileDriver({ path: 'TODO' }),
            matchingHeuristic: relativeUrlHeuristic,
        })
        console.log(await orchestrator.run('scanned'))
    })
})
