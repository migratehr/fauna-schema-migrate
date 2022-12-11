// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

import path from 'path'
import test, { ExecutionContext } from 'ava'
import fs from 'fs-extra'
import { Config } from '../../../src/util/config'
import sinon from 'sinon'
import { cache, CacheFileManager, cacheFileManager } from '../../../src/tasks/cache'
import fsExists from 'fs.promises.exists'

const CACHE_DIR = '.cache'
const testPath = path.relative(process.cwd(), __dirname)
const migrationsPath = path.join(testPath, 'migrations')
const cachePath = path.join(migrationsPath, CACHE_DIR)
const oldCachePath = path.join(testPath, 'old_cache')

let migrationsDirStub: sinon.SinonStub<[], Promise<string>>
let cacheNameStub: sinon.SinonStub<[], Promise<string>>

test.before(async (t: ExecutionContext) => {
  migrationsDirStub = sinon
    .stub(Config.prototype, 'getMigrationsDir')
    .returns(Promise.resolve(path.join(testPath, 'migrations')))
  cacheNameStub = sinon.stub(Config.prototype, 'getCacheName').returns(Promise.resolve(CACHE_DIR))
  if (await fsExists(cachePath)) {
    await fs.promises.rmdir(cachePath, { recursive: true })
  }

  await fs.copy(oldCachePath, cachePath)
})

test.after(async (t: ExecutionContext) => {
  migrationsDirStub.restore()
  cacheNameStub.restore()
})

test('when step size is 1, it adds the missing cache entry', async (t: ExecutionContext) => {
  const writeCachedMigration = sinon.spy({ ...cacheFileManager }, 'writeCachedMigration')

  const cfm: CacheFileManager = {
    ...cacheFileManager,
    writeCachedMigration,
  }

  await cache(cfm)()

  const expected = [
    {
      directoryName: '_2022-12-08T19:45:58.674Z_1',
      includedMigrations: ['2022-12-08T19_45_58.674Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.674Z_2022-12-08T19:45:58.685Z_1',
      includedMigrations: ['2022-12-08T19_45_58.685Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.685Z_2022-12-08T19:45:58.691Z_1',
      includedMigrations: ['2022-12-08T19_45_58.691Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.699Z_1',
      includedMigrations: ['2022-12-08T19_45_58.699Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.699Z_2022-12-08T19:45:58.706Z_1',
      includedMigrations: ['2022-12-08T19_45_58.706Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.706Z_2022-12-08T19:45:58.708Z_1',
      includedMigrations: ['2022-12-08T19_45_58.708Z'],
    },
  ]

  const responses = await Promise.all(
    expected.map(async ({ directoryName }) => {
      const dirPath = path.join(cachePath, directoryName)
      t.is(await fsExists(dirPath), true, `directory ${directoryName} does not exist`)
      const queryPath = path.join(dirPath, 'query.fql')
      const query = await fs.promises.readFile(queryPath, 'utf8')

      const hashTreePath = path.join(dirPath, 'hash-tree.json')
      const hashTree = await fs.promises.readFile(hashTreePath, 'utf8')

      return {
        directoryPath: dirPath,
        query,
        hashTree,
      }
    })
  )

  const directories = responses.map(({ directoryPath }) => directoryPath)
  t.snapshot(directories)

  const queries = responses.map(({ query }) => query)
  t.snapshot(queries)

  const hashTrees = responses.map(({ hashTree }) => hashTree)
  t.snapshot(hashTrees)

  t.is(writeCachedMigration.callCount, 1, 'writeCachedMigration was not called')
})

test('when step size is more than 1, it should create the correct folder and query', async (t: ExecutionContext) => {
  const writeCachedMigration = sinon.spy({ ...cacheFileManager }, 'writeCachedMigration')

  const cfm: CacheFileManager = {
    ...cacheFileManager,
    writeCachedMigration,
  }

  await cache(cfm)(3)

  const expected = [
    {
      directoryName: '_2022-12-08T19:45:58.691Z_3',
      includedMigrations: ['2022-12-08T19_45_58.674Z', '2022-12-08T19_45_58.685Z', '2022-12-08T19_45_58.691Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.708Z_3',
      includedMigrations: ['2022-12-08T19_45_58.699Z', '2022-12-08T19_45_58.706Z', '2022-12-08T19_45_58.708Z'],
    },
  ]

  const responses = await Promise.all(
    expected.map(async ({ directoryName }) => {
      const dirPath = path.join(cachePath, directoryName)
      t.is(await fsExists(dirPath), true, 'Has directory')

      const queryPath = path.join(dirPath, 'query.fql')
      const query = await fs.promises.readFile(queryPath, 'utf8')

      const hashTreePath = path.join(dirPath, 'hash-tree.json')
      const hashTree = await fs.promises.readFile(hashTreePath, 'utf8')

      return {
        directoryPath: dirPath,
        query,
        hashTree,
      }
    })
  )

  const directories = responses.map(({ directoryPath }) => directoryPath)
  t.snapshot(directories)

  const queries = responses.map(({ query }) => query)
  t.snapshot(queries)

  const hashTrees = responses.map(({ hashTree }) => hashTree)
  t.snapshot(hashTrees)

  t.is(writeCachedMigration.callCount, 1, 'writeCachedMigration was not called')

  const expectedDeleted = [
    {
      directoryName: '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.706Z_3',
      includedMigrations: ['2022-12-08T19_45_58.699Z', '2022-12-08T19_45_58.706Z'],
    },
  ]

  // Check that preexisting incomplete cache entries for the step size are removed
  await Promise.all(
    expectedDeleted.map(async ({ directoryName }) => {
      const dirPath = path.join(cachePath, directoryName)
      t.is(await fsExists(dirPath), false, 'Has directory')
    })
  )
})
