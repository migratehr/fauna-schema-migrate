
import path from 'path'
import test, { ExecutionContext } from 'ava';
import { fullApply, setupFullTest, destroyFullTest, multiDatabaseFullApply } from '../../_helpers'
import { getAllCloudResources } from '../../../src/state/from-cloud'
import rollback from '../../../src/tasks/rollback';
import { clientGenerator } from '../../../src/util/fauna-client';
import { LoadedResources } from '../../../src/types/expressions';
import { ResourceTypes } from '../../../src/types/resource-types';

const testPath = path.relative(process.cwd(), __dirname)

let faunaClient: any = null
test.before(async (t: ExecutionContext) => {
    faunaClient = await setupFullTest(testPath)
})

test('update child database contents', async (t: ExecutionContext) => {
    await multiDatabaseFullApply(testPath, ["resources1"],
        // the databases to apply (these all happen in a separate transaction)
        [[], ["child1"], ["child2"], ["child1", "child1a"]])

    let child2Client = await clientGenerator.getClient(["child2"])
    let child2Res = await getAllCloudResources(child2Client)

    let child1aClient = await clientGenerator.getClient(["child1", "child1a"])
    let child1aRes = await getAllCloudResources(child1aClient)

    await multiDatabaseFullApply(testPath, ["resources2"],
        // the databases to apply (these all happen in a separate transaction)
        [[], ["child1"], ["child2"], ["child1", "child1a"]])


    await rollback(1, ["child1", "child1a"])
    await rollback(1, ["child2"])

    let child2ResAfterRollback = await getAllCloudResources(child2Client)
    let child1aResAfterRollback = await getAllCloudResources(child1aClient)
    compareResults(t, child2ResAfterRollback, child2Res)
    compareResults(t, child1aResAfterRollback, child1aRes)

})

test.after(async (t: ExecutionContext) => {
    await destroyFullTest(testPath)
})

const compareResults = (t: ExecutionContext, before: LoadedResources, rollback: LoadedResources) => {
    for (let resourceType in ResourceTypes) {
        const beforeRess = before[resourceType]
        const rollbackRess = rollback[resourceType]
        for (let beforeRes of beforeRess) {
            // test whether an equivalent resource with the same name exists
            const rollbackRes = rollbackRess.find(x => x.name === beforeRes.name)
            t.truthy(rollbackRes)
            // console.log('rollbackRes:', rollbackRes, 'beforeRes', beforeRes)
            // Which contains the same data.
            t.deepEqual(rollbackRes?.jsonData, beforeRes?.jsonData)
        }
    }
}
