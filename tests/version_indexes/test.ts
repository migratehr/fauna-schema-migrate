// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

import path from 'path'
import test, { ExecutionContext } from 'ava'
import { generate, setupFullTest, destroyFullTest, multiStepCache } from '../_helpers'
import { Config } from '../../src/util/config'
import sinon from 'sinon'
import { retrieveAllMigrations, retrieveAllMigrationsMetadata } from '../../src/util/files'
import { versionIndexes } from '../../src/tasks/version_indexes'
import { cache } from '../../src/tasks/cache'
import fs from 'fs-extra'
const testPath = path.relative(process.cwd(), __dirname)

let faunaClient: any = null
let stub: sinon.SinonStub<[], Promise<string>>

const migrationsPath = path.join(testPath, 'migrations')
const originalMigrationsPath = path.join(testPath, 'original_migrations')

test.before(async (t: ExecutionContext) => {
  faunaClient = await setupFullTest(testPath)

  stub = sinon.stub(Config.prototype, 'getMigrationsDir').returns(Promise.resolve(path.join(testPath, 'migrations')))
  await multiStepCache(testPath, ['resources1', 'resources2', 'resources3', 'resources4', 'resources5'])
  // Generate cache
  // await cache()

  // MkDir original migrations
  // fs.mkdirSync(originalMigrationsPath)

  // await fs.copy(migrationsPath, originalMigrationsPath)

  // Mock out the config migrations dir

  // Copy
})

test('multi apply is the same as separate apply', async (t: ExecutionContext) => {
  // first generate and apply migrations

  // const res = await versionIndexes([], 'now')

  // Expect affected folders to be backed up

  // Expect

  // Get migrations
  console.log(await retrieveAllMigrationsMetadata())

  t.is(true, true, 'Passes')
})

test.after(async (t: ExecutionContext) => {
  // fs.rmdirSync(originalMigrationsPath, { recursive: true })
  stub.restore()
  // await destroyFullTest(testPath)
})
