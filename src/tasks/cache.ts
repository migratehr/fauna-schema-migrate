// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0
import fs from 'fs-extra'
import path from 'path'
import fsExists from 'fs.promises.exists'
import { hashElement, HashElementNode } from 'folder-hash'

import { generateApplyQuery, retrieveLocalDiffCurrentTarget } from '../migrations/advance'
import { transformDiffToExpressions } from '../migrations/diff'
import { ExpectedNumberOfMigrations } from '../errors/ExpectedNumber'
import { config } from '../util/config'
import { printMessage } from '../interactive-shell/shell'
import { childDbPathToFullPath, retrieveAllMigrations } from '../util/files'

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

export const cacheFileManager = {
  async getMigrationsDir() {
    const migrationsDir = await config.getMigrationsDir()
    return migrationsDir
  },
  async getCacheDirectory(atChildDbPath: string[]) {
    const childDbsDir = await config.getChildDbsDirName()
    const migrationsDir = await config.getMigrationsDir()
    const cacheFolderName = await config.getCacheName()
    const fullPath = childDbPathToFullPath(migrationsDir, atChildDbPath, childDbsDir)
    const cacheDir = path.join(fullPath, cacheFolderName)
    return cacheDir
  },
  async existsCacheDirectory(atChildDbPath: string[]) {
    const cacheDir = await this.getCacheDirectory(atChildDbPath)
    return fsExists(cacheDir)
  },
  async makeCacheDirectory(atChildDbPath: string[]) {
    const cacheDir = await this.getCacheDirectory(atChildDbPath)
    await fs.promises.mkdir(cacheDir, { recursive: true })
  },
  async getCachedMigrationPath(atChildDbPath: string[], { from, target, stepSize }: MigrationChunkInfo) {
    const cacheDir = await this.getCacheDirectory(atChildDbPath)
    const cacheFolderName = [from ?? '', target, stepSize].join('_')
    return path.join(cacheDir, cacheFolderName)
  },
  async cachedMigrationExists(atChildDbPath: string[], chunk: MigrationChunkInfo) {
    return fsExists(await this.getCachedMigrationPath(atChildDbPath, chunk))
  },
  async getCachedMigrationHash(atChildDbPath: string[], chunk: MigrationChunkInfo) {
    const cacheDir = await this.getCachedMigrationPath(atChildDbPath, chunk)
    const hashTreePath = path.join(cacheDir, 'hash-tree.json')
    return JSON.parse(await fs.promises.readFile(hashTreePath, 'utf-8')).hash as string
  },

  async writeCachedMigration(
    atChildDbPath: string[],
    chunk: MigrationChunkInfo,
    fql: string,
    hashTree: HashElementNode
  ) {
    const cacheDir = await this.getCachedMigrationPath(atChildDbPath, chunk)
    await fs.promises.mkdir(cacheDir, { recursive: true })
    await Promise.all([
      fs.promises.writeFile(path.join(cacheDir, 'query.fql'), fql),
      fs.promises.writeFile(path.join(cacheDir, 'hash-tree.json'), JSON.stringify(hashTree)),
    ])
  },

  async removeCachedMigration(atChildDbPath: string[], chunk: MigrationChunkInfo) {
    const cacheDir = await this.getCachedMigrationPath(atChildDbPath, chunk)
    await fs.promises.rmdir(cacheDir, { recursive: true })
  },
}

export type CacheFileManager = typeof cacheFileManager

export const cache =
  (cfm: CacheFileManager = cacheFileManager) =>
  async (amount: number | string = 1, atChildDbPath: string[] = []) => {
    validateNumber(amount)

    const localMigrations = await retrieveAllMigrations(atChildDbPath)
    const chunkSize = typeof amount === 'string' ? parseInt(amount, 10) : amount
    const chunks = getMigrationChunkInfo(localMigrations, chunkSize)

    if (chunks.length === 0) {
      printMessage('Nothing to cache')
      return
    }

    if (!(await cfm.existsCacheDirectory(atChildDbPath))) {
      await cfm.makeCacheDirectory(atChildDbPath)
    }

    const responses = await Promise.all(
      chunks.map(async (chunk) => {
        const hashTree = await hashElement(await cfm.getMigrationsDir(), {
          folders: { include: chunk.migrations.map((migration) => migration.replaceAll(':', '_')) },
        })

        if (await cfm.cachedMigrationExists(atChildDbPath, chunk)) {
          const cachedHash = await cfm.getCachedMigrationHash(atChildDbPath, chunk)
          if (cachedHash !== hashTree.hash) {
            return {
              chunk,
              action: 'invalid_checksum',
            }
          }

          return {
            chunk,
            action: 'exists',
          }
        }

        const queryString = (await generateLocalSkippedMigration(atChildDbPath, chunk)).toFQL()
        await cfm.writeCachedMigration(atChildDbPath, chunk, queryString, hashTree)
        return {
          chunk,
          action: 'generated',
        }
      })
    )

    // Regenerage queries and hashes for all chunks after the first `action: 'invalid_checksum'` chunk.
    const firstInvalidChecksumIndex = responses.findIndex((response) => response.action === 'invalid_checksum')
    if (firstInvalidChecksumIndex !== -1) {
      const chunksToRegenerate = responses.slice(firstInvalidChecksumIndex).map((response) => response.chunk)
      const responsesToRegenerate = await Promise.all(
        chunksToRegenerate.map(async (chunk) => {
          const hashTree = await hashElement(await cfm.getMigrationsDir(), {
            folders: { include: chunk.migrations.map((migration) => migration.replaceAll(':', '_')) },
          })

          const queryString = (await generateLocalSkippedMigration(atChildDbPath, chunk)).toFQL()
          await cfm.writeCachedMigration(atChildDbPath, chunk, queryString, hashTree)
          return {
            chunk,
            action: 'regenerated',
          }
        })
      )

      return [...responses.slice(0, firstInvalidChecksumIndex), ...responsesToRegenerate]
    }

    return responses

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
