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
const migrationsPath = path.join(testPath, 'migrations')
const cachePath = path.join(migrationsPath, CACHE_DIR)

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
  // if (await fsExists(cachePath)) {
  //   await fs.promises.rmdir(cachePath, { recursive: true })
  // }
})

test('when step size is 1, it should create the correct folder and query', async (t: ExecutionContext) => {
  console.log(await cache()())

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
  ]

  const responses = await Promise.all(
    expected.map(async ({ directoryName }) => {
      const dirPath = path.join(cachePath, directoryName)
      t.is(await fsExists(dirPath), true, 'Has directory')

      const queryPath = path.join(dirPath, 'query.fql')
      const query = await fs.promises.readFile(queryPath, 'utf8')

      const hashTreePath = path.join(dirPath, 'hash-tree.json')
      const hashTree = await fs.promises.readFile(hashTreePath, 'utf8')

      const metaPath = path.join(dirPath, 'meta.json')
      const meta = await fs.promises.readFile(metaPath, 'utf8')

      return {
        directoryPath: dirPath,
        query,
        hashTree,
        meta,
      }
    })
  )

  const directories = responses.map(({ directoryPath }) => directoryPath)
  t.snapshot(directories)

  const queries = responses.map(({ query }) => query)
  t.snapshot(queries)

  const hashTrees = responses.map(({ hashTree }) => hashTree)
  t.snapshot(hashTrees)

  const meta = responses.map(({ meta }) => meta)
  t.snapshot(meta)
})

test('when step size is more than 1, it should create the correct folder and query', async (t: ExecutionContext) => {
  console.log(await cache()(3))

  const expected = [
    {
      directoryName: '_2022-12-08T19:45:58.691Z_3',
      includedMigrations: ['2022-12-08T19_45_58.674Z', '2022-12-08T19_45_58.685Z', '2022-12-08T19_45_58.691Z'],
    },
    {
      directoryName: '2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.706Z_3',
      includedMigrations: ['2022-12-08T19_45_58.699Z', '2022-12-08T19_45_58.706Z'],
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

      const metaPath = path.join(dirPath, 'meta.json')
      const meta = await fs.promises.readFile(metaPath, 'utf8')

      return {
        directoryPath: dirPath,
        query,
        hashTree,
        meta,
      }
    })
  )

  const directories = responses.map(({ directoryPath }) => directoryPath)
  t.snapshot(directories)

  const queries = responses.map(({ query }) => query)
  t.snapshot(queries)

  const hashTrees = responses.map(({ hashTree }) => hashTree)
  t.snapshot(hashTrees)

  const meta = responses.map(({ meta }) => meta)
  t.snapshot(meta)
})

// test('it creates an FQL file equivilent to the processed migration in the directory', (t: ExecutionContext) => {})
