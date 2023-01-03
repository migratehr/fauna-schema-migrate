import fs from 'fs'
import path from 'path'

import { ExpectedNumberOfMigrations } from '../errors/ExpectedNumber'
import { cacheFileManager, CacheFileManager, MigrationChunkInfo } from './cache'

export const cacheOptimise =
  (cfm: CacheFileManager = cacheFileManager) =>
  async (amount: number | string = 1, atChildDbPath: string[] = []) => {
    validateNumber(amount)

    try {
      const existingMigrationChunks = (
        await Promise.all(
          (
            await fs.promises.readdir(await cfm.getCacheDirectory(atChildDbPath))
          ).map(async (folder) => {
            const metaPath = path.join(await cfm.getCacheDirectory(atChildDbPath), folder, 'meta.json')
            return JSON.parse(await fs.promises.readFile(metaPath, 'utf-8')) as MigrationChunkInfo
          })
        )
      ).filter((chunk) => chunk.stepSize === amount)

      const out = await Promise.all(
        existingMigrationChunks.map(async (chunk) => {
          const path = await cfm.getCachedMigrationPath(atChildDbPath, chunk)
          const fql = await cfm.readCachedMigrationFQL(atChildDbPath, chunk)
          const createIndexes = fql.matchAll(/CreateIndex\((.+?)\)/g)
          const createInfo = Array.from(createIndexes).map(([match, config]) => ({
            match,
            name: JSON.parse(config).name as string,
            operation: 'create',
            type: 'index',
            path,
            target: chunk.target,
          }))

          const deleteIndexes = fql.matchAll(/Delete\(Index\("(.+?)"\)\)/g)
          const deleteInfo = Array.from(deleteIndexes).map(([match, indexName]) => ({
            match,
            name: indexName,
            operation: 'delete',
            type: 'index',
            path,
            target: chunk.target,
          }))

          return [...createInfo, ...deleteInfo]
        })
      )

      // Group by name and order by target in hashmap
      const grouped = out.flat().reduce(
        (acc, curr) => ({
          ...acc,
          [curr.name]: [...(acc[curr.name] || []), curr].sort((a, b) => a.target.localeCompare(b.target)),
        }),
        {} as Record<string, typeof out[0]>
      )

      // If the grouped array has more than 1 item, we have a cache conflict to optimise
      const conflicts = Object.values(grouped)
        .filter((arr) => arr.length > 1)
        .map((arr) => Array.from({ length: arr.length / 2 }, (_, i) => arr.slice(i * 2, i * 2 + 2)))

      // For each conflicted index
      // For each pair of create/delete
      // Append the suffix cache_optimised_<index> any uses of the index in the files between the create and delete target dates
      await Promise.all(
        conflicts.map(async (conflict) => {
          await Promise.all(
            conflict.map(([createIndex, deleteIndex], conflictIndex) => {
              // Get existingMigrationChunks between createIndex and deleteIndex targets
              const createIndexTarget = createIndex.target
              const deleteIndexTarget = deleteIndex.target
              const migrationsBetween = existingMigrationChunks.filter(
                (chunk) =>
                  chunk.target.localeCompare(createIndexTarget) >= 0 &&
                  chunk.target.localeCompare(deleteIndexTarget) <= 0
              )
              return Promise.all(
                migrationsBetween.map(async (chunk) => {
                  // Replace all instances of "<createIndex.name>" with prefixed string
                  const fql = await cfm.readCachedMigrationFQL(atChildDbPath, chunk)
                  // Note: Assumes that no collection has the same name as an index
                  const newFql = fql.replace(
                    new RegExp(`"${createIndex.name}"`, 'g'),
                    `"_cache_optimised_${createIndex.name}_${conflictIndex}"`
                  )
                  await cfm.optimiseCachedMigrationFQL(atChildDbPath, chunk, newFql)
                })
              )
            })
          )
        })
      )
    } catch (error) {
      console.error(error)
      throw error
    }
  }

const validateNumber = (str: any) => {
  if (str !== 'all' && (isNaN(str) || isNaN(parseFloat(str)))) {
    throw new ExpectedNumberOfMigrations(str)
  }
}

export default cacheOptimise
