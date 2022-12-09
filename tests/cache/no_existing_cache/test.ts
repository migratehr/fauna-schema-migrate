// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

import path from 'path'
import test, { ExecutionContext } from 'ava'
import fs from 'fs'
import { Config } from '../../../src/util/config'
import sinon from 'sinon'
import { cache } from '../../../src/tasks/cache'
import fsExists from 'fs.promises.exists'

const testPath = path.relative(process.cwd(), __dirname)
const cachePath = path.join(testPath, 'migrations', '.cache')

let stub: sinon.SinonStub<[], Promise<string>>

test.before(async (t: ExecutionContext) => {
  stub = sinon.stub(Config.prototype, 'getMigrationsDir').returns(Promise.resolve(path.join(testPath, 'migrations')))
  if (await fsExists(cachePath)) {
    await fs.promises.rmdir(cachePath, { recursive: true })
  }
})

test('when apply size is 1, it should create a cache folder for each migration in the format <from?>_<to>_step', async (t: ExecutionContext) => {
  console.log(await cache())

  const expectedDirectories = [
    '_2022-12-08T19:45:58.674Z_1',
    '2022-12-08T19:45:58.674Z_2022-12-08T19:45:58.685Z_1',
    '2022-12-08T19:45:58.685Z_2022-12-08T19:45:58.691Z_1',
    '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.699Z_1',
    '2022-12-08T19:45:58.699Z_2022-12-08T19:45:58.706Z_1',
  ]

  const responses = await Promise.all(
    expectedDirectories.map(async (dir) => {
      const dirPath = path.join(cachePath, dir)
      return fsExists(dirPath)
    })
  )
  console.log(responses)

  t.is(responses.every(Boolean), true, 'Passes')
})

test.after(async (t: ExecutionContext) => {
  // await fs.promises.rmdir(cachePath, { recursive: true })
  stub.restore()
})
