// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

import path from 'path'
import test, { ExecutionContext } from 'ava'
import fs from 'fs'
import { Config } from '../../../src/util/config'
import sinon from 'sinon'
import { cache } from '../../../src/tasks/cache'
import fsExists from 'fs.promises.exists'

const CACHE_DIR = '.cache'
const testPath = path.relative(process.cwd(), __dirname)
const cachePath = path.join(testPath, 'migrations', CACHE_DIR)

let migrationsDirStub: sinon.SinonStub<[], Promise<string>>
let cacheNameStub: sinon.SinonStub<[], Promise<string>>

test.before(async (t: ExecutionContext) => {
  migrationsDirStub = sinon
    .stub(Config.prototype, 'getMigrationsDir')
    .returns(Promise.resolve(path.join(testPath, 'migrations')))
  cacheNameStub = sinon.stub(Config.prototype, 'getCacheName').returns(Promise.resolve(CACHE_DIR))
})

test.beforeEach(async (t: ExecutionContext) => {
  if (await fsExists(cachePath)) {
    await fs.promises.rmdir(cachePath, { recursive: true })
  }
})

test.after(async (t: ExecutionContext) => {
  migrationsDirStub.restore()
  cacheNameStub.restore()
  if (await fsExists(cachePath)) {
    await fs.promises.rmdir(cachePath, { recursive: true })
  }
})

test('when step size is 1, it should create the correct folder and query', async (t: ExecutionContext) => {
  console.log(await cache())

  const expected = [
    {
      directoryName: '_2022-12-08T19:45:58.674Z_1',
    },
    {
      directoryName: '2022-12-08T19:45:58.674Z_2022-12-08T19:45:58.685Z_1',
    },
    {
      directoryName: '2022-12-08T19:45:58.685Z_2022-12-08T19:45:58.691Z_1',
    },
    {
      directoryName: '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.699Z_1',
    },
    {
      directoryName: '2022-12-08T19:45:58.699Z_2022-12-08T19:45:58.706Z_1',
    },
  ]

  const responses = await Promise.all(
    expected.map(async ({ directoryName }) => {
      const dirPath = path.join(cachePath, directoryName)
      t.is(await fsExists(dirPath), true, 'Has directory')

      const queryPath = path.join(dirPath, 'query.fql')
      const query = await fs.promises.readFile(queryPath, 'utf8')

      return {
        directoryPath: dirPath,
        query,
      }
    })
  )

  const directories = responses.map(({ directoryPath }) => directoryPath)
  t.snapshot(directories)

  const queries = responses.map(({ query }) => query)
  t.snapshot(queries)
})

test('when step size is more than 1, it should create the correct folder and query', async (t: ExecutionContext) => {
  console.log(await cache(3))

  const expected = [
    {
      directoryName: '_2022-12-08T19:45:58.691Z_3',
    },
    {
      directoryName: '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.706Z_3',
    },
  ]

  const responses = await Promise.all(
    expected.map(async ({ directoryName }) => {
      const dirPath = path.join(cachePath, directoryName)
      t.is(await fsExists(dirPath), true, 'Has directory')

      const queryPath = path.join(dirPath, 'query.fql')
      const query = await fs.promises.readFile(queryPath, 'utf8')

      return {
        directoryPath: dirPath,
        query,
      }
    })
  )

  const directories = responses.map(({ directoryPath }) => directoryPath)
  t.snapshot(directories)

  const queries = responses.map(({ query }) => query)
  t.snapshot(queries)
})

// test('it creates an FQL file equivilent to the processed migration in the directory', (t: ExecutionContext) => {})
