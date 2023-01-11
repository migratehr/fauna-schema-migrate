// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0
import fs from 'fs-extra'
import path from 'path'
import fsExists from 'fs.promises.exists'
import { hashElement, HashElementNode } from 'folder-hash'
import lockfile from 'proper-lockfile'

import { generateApplyQuery, retrieveLocalDiffCurrentTarget } from '../migrations/advance'
import { transformDiffToExpressions } from '../migrations/diff'
import { ExpectedNumberOfMigrations } from '../errors/ExpectedNumber'
import { config } from '../util/config'
import { printMessage } from '../interactive-shell/shell'
import { childDbPathToFullPath, retrieveAllMigrations } from '../util/files'

export interface MigrationChunkInfo {
  from?: string
  target: string
  stepSize: number
  migrations: string[]
  isComplete: boolean
  isOptimised?: boolean
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

  async readCachedMigrationFQL(atChildDbPath: string[], chunk: MigrationChunkInfo) {
    const cacheDir = await this.getCachedMigrationPath(atChildDbPath, chunk)
    return await fs.promises.readFile(path.join(cacheDir, 'query.fql'), 'utf-8')
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
      fs.promises.writeFile(path.join(cacheDir, 'meta.json'), JSON.stringify(chunk)),
    ])
  },

  async optimiseCachedMigrationFQL(atChildDbPath: string[], chunk: MigrationChunkInfo, fql: string) {
    const cacheDir = await this.getCachedMigrationPath(atChildDbPath, chunk)
    const filepath = path.join(cacheDir, 'query.fql')

    const release = await lockfile.lock(filepath)
    await Promise.all([
      fs.promises.writeFile(filepath, fql),
      fs.promises.writeFile(
        path.join(cacheDir, 'meta.json'),
        JSON.stringify({
          ...chunk,
          // TODO: Include better optimisation records
          isOptimised: true,
        })
      ),
    ])

    await release()
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

    // Get exsiting cached migration metadata
    const existingMigrationChunks = await Promise.all(
      (
        await fs.promises.readdir(await cfm.getCacheDirectory(atChildDbPath))
      ).map(async (folder) => {
        const metaPath = path.join(await cfm.getCacheDirectory(atChildDbPath), folder, 'meta.json')
        return JSON.parse(await fs.promises.readFile(metaPath, 'utf-8')) as MigrationChunkInfo
      })
    )

    // Matching incomplete chunks
    const incompleteChunks = chunks.filter((chunk) => !chunk.isComplete).filter((chunk) => chunk.stepSize === chunkSize)
    const existingIncompleteChunks = existingMigrationChunks
      .filter((chunk) => !chunk.isComplete)
      .filter((chunk) => chunk.stepSize === chunkSize)

    // Get existing migration chunks that do not match incomplete chunks
    const outdatedExistingIncompleteChunks = existingIncompleteChunks.filter(
      (existingChunk) =>
        !incompleteChunks.some(
          (incompleteChunk) =>
            existingChunk.from === incompleteChunk.from &&
            existingChunk.target === incompleteChunk.target &&
            existingChunk.stepSize === incompleteChunk.stepSize
        )
    )
    console.log('Outdated incomplete chunks')
    console.log(outdatedExistingIncompleteChunks)

    // Remove outdated incomplete chunks
    await Promise.all(
      outdatedExistingIncompleteChunks.map(async (chunk) => {
        await cfm.removeCachedMigration(atChildDbPath, chunk)
      })
    )

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
  }

const validateNumber = (str: any) => {
  if (str !== 'all' && (isNaN(str) || isNaN(parseFloat(str)))) {
    throw new ExpectedNumberOfMigrations(str)
  }
}

export default cache
