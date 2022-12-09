// // Optimisation to avoid the 60s bottleneck when recreating a previously cached index
// // NOTE: Rewrites history, so only do this if you're sure. Backups will be created in the .backups folder
// // under <timestamp>-index-versioning-backup

// // Loop through array in reverse
// // On find `create-index-<name>`, add it to a hash map {[name]: true}
// // On find `delete-index-<name>`, check if <name> exists in hash map, if not, continue
// // .   - If so:
// // .   - Create backup of file in .backups/<timestamp>-index-versioning-backup
// // .   - Rename `delete-index-<name>` to `delete-index-<name>_0`
// // .   - Cycle through previous files, match any with instances of `<name>`
// // .   - Create backup of file in .backups/<timestamp>-index-versioning-backup/<migration>/<filename>
// // .   - Rename all instances of "<name>" previously to "<name>_0"
// //     - If the file name is create-index<name>, rename it to create-index-<name>_0
// // continue
// // May result in chained _0_0 in extreme cases, but this is fine
// import fsExists from 'fs.promises.exists'
// import fs from 'fs'
// import path from 'path'
// import { printMessage } from '../interactive-shell/shell'

// import {
//   childDbPathToFullPath,
//   retrieveAllMigrations,
//   retrieveCachedMigrations,
//   writeMigrationToCache,
// } from '../util/files'
// import { evalFQLCode } from '../fql/eval'
// import { config } from '../util/config'

// export const versionIndexes = async (
//   atChildDbPath: string[] = [],
//   date = new Date().toISOString(),
//   existingHash = {}
// ) => {
//   try {
//     const migrations = (await retrieveAllMigrationsMetadata(atChildDbPath)).reverse()
//     console.log(migrations)
//     const migrationsDir = await config.getMigrationsDir()
//     const dbName = atChildDbPath.length > 0 ? `[ DB: ROOT > ${atChildDbPath.join(' > ')} ]` : '[ DB: ROOT ]'
//     printMessage(dbName)

//     const backupPath = path.join(migrationsDir, '.backups', `${date}-index-versioning-backup`)
//     if (!(await fsExists(backupPath))) await fs.promises.mkdir(backupPath, { recursive: true })

//     const createdIndexNameHash: Record<string, true> = {
//       ...existingHash,
//     }

//     const needsModification = ({ action, type, name }: MigrationMetadata) => {
//       // Check if the migration is a create-index
//       if (action === 'create' && type === 'index') {
//         createdIndexNameHash[name] = true
//         return false
//       }

//       // Check if the migration is a delete-index
//       if (action === 'delete' && type === 'index') {
//         // Not recreated, proceed
//         if (!createdIndexNameHash[name]) return false
//         return true
//       }

//       return false
//     }

//     let i = 0
//     let migration = migrations[i]
//     while (i < migrations.length && !needsModification(migration)) {
//       migration = migrations[++i]
//     }

//     if (i === migrations.length) return

//     const { name, type } = migration

//     // Rename any previous instances of name to name_0 in all previous files
//     // (remember that we're reversed!)
//     // Include current file in this list
//     const previousMigrations = migrations.slice(i)

//     // Check if should modify any of the previous migrations (i.e. if they contain the target name)

//     const migrationsToModify = await Promise.all(
//       previousMigrations.map(async (previousMigration) => {
//         const fileContents = await fs.promises.readFile(previousMigration.filepath, 'utf8')
//       })
//     )

//     const modifyPreviousMigrations = previousMigrations.map(async (previousMigration) => {
//       console.log(previousMigration)
//       console.log('creating backup')
//       // Create backup of file in migrations/.backups folder with timestamp
//       const backupDir = path.join(backupPath, previousMigration.migrationPath)
//       if (!(await fsExists(backupDir))) {
//         await fs.promises.mkdir(backupDir)
//       }
//       const backupFilePath = path.join(backupPath, previousMigration.relativePath)
//       if (!(await fsExists(backupFilePath))) await fs.promises.copyFile(previousMigration.filepath, backupPath)

//       // Replace all instances of name string with name_0 string
//       const fileContents = await fs.promises.readFile(previousMigration.filepath, 'utf8')
//       const newFileContents = fileContents.replaceAll(`"${name}"`, `"${name}_0"`)
//       await fs.promises.writeFile(previousMigration.filepath, newFileContents)

//       // Rename if existing create or delete file
//       if (
//         ['delete', 'create'].includes(previousMigration.action) &&
//         type === previousMigration.type &&
//         name === previousMigration.name
//       ) {
//         // Rename `delete-index-<name>` to `delete-index-<name>_0`
//         const newFilepath = path.join(
//           migrationsDir,
//           previousMigration.migrationPath,
//           `${previousMigration.action}-${previousMigration.type}-${previousMigration.name}_0.fql`
//         )
//         await fs.promises.rename(previousMigration.filepath, newFilepath)
//       }
//     })

//     await Promise.all(modifyPreviousMigrations)

//     // Recurse
//     await versionIndexes(atChildDbPath, date, createdIndexNameHash)
//   } catch (e) {
//     throw e
//   }
// }

// export interface MigrationMetadata {
//   name: string
//   action: string
//   type: string
//   filename: string
//   filepath: string
//   migrationPath: string
//   relativePath: string
// }

// export const retrieveAllMigrationsMetadata = async (atChildDbPath: string[] = []): Promise<MigrationMetadata[]> => {
//   const childDbsDir = await config.getChildDbsDirName()
//   const migrationsDir = await config.getMigrationsDir()
//   const fullPath = childDbPathToFullPath(path.join(migrationsDir), atChildDbPath, childDbsDir)
//   return getDirectories(fullPath, true, childDbsDir)
//     .sort()
//     .flatMap((d) => {
//       const dir = path.join(fullPath, d)
//       const files = fs.readdirSync(dir)
//       // Filter .fql files and remove .fql extension

//       return files
//         .filter((f) => f.endsWith('.fql'))
//         .map((filename) => {
//           const [action, type, ...name] = filename.split('-')
//           return {
//             name: name.join('-').replace('.fql', ''),
//             action,
//             type,
//             filename,
//             filepath: path.join(dir, filename),
//             migrationPath: d,
//             relativePath: `${d}${path.sep}${filename}`,
//           }
//         })
//     })
// }
