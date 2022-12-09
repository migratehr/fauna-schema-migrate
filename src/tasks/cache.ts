// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

import { isMissingMigrationCollectionFaunaError, isSchemaCachingFaunaError } from '../errors/detect-errors'
import { prettyPrintExpr } from '../fql/print'
import {
  retrieveMigrationInfo,
  getCurrentAndTargetMigration,
  generateApplyQuery,
  retrieveDiffCurrentTarget,
  retrieveLocalDiffCurrentTarget,
} from '../migrations/advance'
import { transformDiffToExpressions } from '../migrations/diff'
import { clientGenerator } from '../util/fauna-client'
import { ExpectedNumberOfMigrations } from '../errors/ExpectedNumber'
import { config } from '../util/config'
import { printMessage } from '../interactive-shell/shell'
import boxen from 'boxen'
import { highlight } from 'cli-highlight'
import fs from 'fs-extra'
import path from 'path'
import fsExists from 'fs.promises.exists'

import {
  childDbPathToFullPath,
  retrieveAllMigrations,
  retrieveCachedMigrations,
  writeMigrationToCache,
} from '../util/files'
import { evalFQLCode } from '../fql/eval'

interface CacheMetadata {
  to: string
  from: string
  stepSize: number
}

// On cache size,

// Store cache in

// Stages to tackle
// 1. Cache from scratch
// 2. Cache from existing cache
// 2. Apply reindexing fix

// Cache folder structure
//
// <datefrom>-<dateto>-<stepsize>.fql
// Metadata file:

interface MigrationChunkInfo {
  from?: string
  target: string
  stepSize: number
  migrations: string[]
  isComplete: boolean
}

function getMigrationChunkInfo(migrationArray: string[], chunk_size: number) {
  const output: MigrationChunkInfo[] = []
  for (let i = 0; i < migrationArray.length; i += chunk_size) {
    const slice = migrationArray.slice(i, i + chunk_size)
    output.push({
      from: i === 0 ? undefined : migrationArray[i - 1],
      target: slice[slice.length - 1],
      stepSize: chunk_size,
      isComplete: slice.length === chunk_size,
      migrations: slice,
    })
  }
  return output
}

const generateLocalSkippedMigration = async (
  atChildDbPath: string[],
  { from, target, migrations }: MigrationChunkInfo
) => {
  const skipped = migrations.slice(0, -1)
  const diff = await retrieveLocalDiffCurrentTarget(atChildDbPath, target, from)
  const expressions = transformDiffToExpressions(diff)
  const migrCollection = await config.getMigrationCollection()
  return await generateApplyQuery(expressions, skipped, target, migrCollection)
}

export const cache = async (amount: number | string = 1, atChildDbPath: string[] = []) => {
  validateNumber(amount)

  const localMigrations = await retrieveAllMigrations(atChildDbPath)
  console.log(localMigrations)
  const chunkSize = typeof amount === 'string' ? parseInt(amount, 10) : amount
  const chunks = getMigrationChunkInfo(localMigrations, chunkSize)

  if (chunks.length === 0) {
    printMessage('Nothing to cache')
    return
  }

  const childDbsDir = await config.getChildDbsDirName()
  const migrationsDir = await config.getMigrationsDir()
  const cacheFolderName = await config.getCacheName()
  const fullPath = childDbPathToFullPath(migrationsDir, atChildDbPath, childDbsDir)
  const cacheDir = path.join(fullPath, cacheFolderName)
  console.log(cacheDir)
  //   console.log(cachedMigrationDir)
  if (!(await fsExists(cacheDir))) {
    console.log('not exists')
    await fs.promises.mkdir(cacheDir, { recursive: true })
  }

  const cached = await Promise.all(
    chunks.map(async (chunk) => {
      const cacheFolderName = [chunk.from ?? '', chunk.target, chunk.stepSize].join('_')

      const chunkCacheDir = path.join(cacheDir, cacheFolderName)
      console.log(chunkCacheDir)
      if (await fsExists(chunkCacheDir)) {
        console.log('exists')
        // Check the checksum of the cached migration against the current migration
        // If they match, then we can use the cached migration
        // If they don't match, then we need to regenerate the cached migration
        return
      }

      console.log('not exists')
      console.log(chunkCacheDir)
      await fs.promises.mkdir(chunkCacheDir, { recursive: true })
      const FQLQuery = (await generateLocalSkippedMigration(atChildDbPath, chunk)).toFQL()
      // Generate checksum from the original migration folder

      // Save FQL Query to query.fql file in chunkCacheDir
      await fs.promises.writeFile(path.join(chunkCacheDir, 'query.fql'), FQLQuery)
      // const cachedPath = path.join(cachedMigrationDir, cacheFolder)
    })
  )

  return

  //   let query: any = null
  //   const client = await clientGenerator.getClient(atChildDbPath)

  //   try {
  //     const migInfo = await retrieveAllMigrations(atChildDbPath)

  //     // Parse parameter
  //     const maxAmount = migInfo.allLocalMigrations.length - migInfo.allCloudMigrations.length
  //     if (amount === 'all') {
  //       amount = maxAmount
  //     } else if (typeof amount === 'string') {
  //       amount = parseInt(amount)
  //     }
  //     amount = Math.min(amount, maxAmount)

  //     // Get info on current state.
  //     printMessage(`     ☁️ Retrieving current cloud migration state`, 'info')
  //     const allCloudMigrationTimestamps = migInfo.allCloudMigrations.map((e) => e.timestamp)
  //     printMessage(`     🤖 Retrieved current migration state`, 'info')

  //     if (migInfo.allCloudMigrations.length < migInfo.allLocalMigrations.length) {
  //       const currTargetSkipped = await getCurrentAndTargetMigration(
  //         migInfo.allLocalMigrations,
  //         migInfo.allCloudMigrations,
  //         amount
  //       )

  //       const dbName = atChildDbPath.length > 0 ? `[ DB: ROOT > ${atChildDbPath.join(' > ')} ]` : '[ DB: ROOT ]'

  //       printMessage(dbName)

  //       // TODO: Child path...
  //       const cachedMigrations = await retrieveCachedMigrations()
  //       console.log(cachedMigrations)

  //       // Get hash of current and target migration
  //       const hashcode = [
  //         ...(currTargetSkipped.current?.timestamp ? [currTargetSkipped.current.timestamp] : []),
  //         currTargetSkipped.target,
  //       ].join('-')

  //       printMessage(hashcode)

  //       const cachedPath = cachedMigrations[hashcode]

  //       printMessage(`cached path: ${cachedPath}`)

  //       if (cachedPath) {
  //         printMessage(`     📦 Using cached migration`, 'info')
  //         query = evalFQLCode(fs.readFileSync(cachedPath, 'utf8'))
  //         console.log(query)
  //       } else {
  //         printMessage(`Generating migration code`)
  //         let messages: string[] = []

  //         migInfo.allLocalMigrations.forEach((l, index) => {
  //           let msg = ''
  //           if (index === allCloudMigrationTimestamps.length + Number(amount) - 1) {
  //             msg = `${l} ← apply target`
  //           } else if (index === allCloudMigrationTimestamps.length - 1) {
  //             msg = `${allCloudMigrationTimestamps[index]} ← cloud state`
  //           } else {
  //             msg = `${l}`
  //           }
  //           messages.push(msg)
  //         })

  //         console.log(boxen(messages.join('\n'), { padding: 1 }))
  //         const diff = await retrieveDiffCurrentTarget(atChildDbPath, currTargetSkipped.current, currTargetSkipped.target)
  //         const expressions = transformDiffToExpressions(diff)
  //         const migrCollection = await config.getMigrationCollection()
  //         query = await generateApplyQuery(
  //           expressions,
  //           currTargetSkipped.skipped,
  //           currTargetSkipped.target,
  //           migrCollection
  //         )
  //         printMessage(`${dbName} Generated migration code`)

  //         // TODO: Move under only if query successful? Remove if not?
  //         // Cache migration query in .cache
  //         await writeMigrationToCache(atChildDbPath, hashcode, query.toFQL())

  //         const code = highlight(prettyPrintExpr(query), { language: 'clojure' })
  //         console.log(boxen(code, { padding: 1 }))
  //         printMessage(`     📦 Cached migration`, 'info')
  //       }
  //     } else {
  //       printMessage(`     ✅ Done, no migrations to cache`, 'success')
  //     }
  //   } catch (error) {
  //     const missingMigrDescription = isMissingMigrationCollectionFaunaError(error)
  //     if (missingMigrDescription) {
  //       printMessage(`The migrations collection is missing, \n did you run 'init' first?`, 'info')
  //       return
  //     }
  //     throw error
  //   }
}

const validateNumber = (str: any) => {
  if (str !== 'all' && (isNaN(str) || isNaN(parseFloat(str)))) {
    throw new ExpectedNumberOfMigrations(str)
  }
}

export default cache
