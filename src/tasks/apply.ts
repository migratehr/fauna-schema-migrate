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
import fs from 'fs'
import path from 'path'

import { retrieveCachedMigrations, writeMigrationToCache } from '../util/files'
import { evalFQLCode } from '../fql/eval'

const apply = async (amount: number | string = 1, atChildDbPath: string[] = []) => {
  validateNumber(amount)

  let query: any = null
  const client = await clientGenerator.getClient(atChildDbPath)

  try {
    const migInfo = await retrieveMigrationInfo(client, atChildDbPath)

    // Parse parameter
    const maxAmount = migInfo.allLocalMigrations.length - migInfo.allCloudMigrations.length
    if (amount === 'all') {
      amount = maxAmount
    } else if (typeof amount === 'string') {
      amount = parseInt(amount)
    }
    amount = Math.min(amount, maxAmount)

    // Get info on current state.
    printMessage(`     ☁️ Retrieving current cloud migration state`, 'info')
    const allCloudMigrationTimestamps = migInfo.allCloudMigrations.map((e) => e.timestamp)
    printMessage(`     🤖 Retrieved current migration state`, 'info')

    if (migInfo.allCloudMigrations.length < migInfo.allLocalMigrations.length) {
      const currTargetSkipped = await getCurrentAndTargetMigration(
        migInfo.allLocalMigrations,
        migInfo.allCloudMigrations,
        amount
      )

      const dbName = atChildDbPath.length > 0 ? `[ DB: ROOT > ${atChildDbPath.join(' > ')} ]` : '[ DB: ROOT ]'

      printMessage(dbName)

      // TODO: Child path...
      const cachedMigrations = await retrieveCachedMigrations()
      console.log(cachedMigrations)

      // Get hash of current and target migration
      const hashcode = [
        ...(currTargetSkipped.current?.timestamp ? [currTargetSkipped.current.timestamp] : []),
        currTargetSkipped.target,
      ].join('-')

      printMessage(hashcode)

      const cachedPath = cachedMigrations[hashcode]

      printMessage(`cached path: ${cachedPath}`)

      if (cachedPath) {
        query = evalFQLCode(fs.readFileSync(cachedPath, 'utf8'))
        printMessage(`     📦 Using cached migration`, 'info')
      } else {
        printMessage(`Generating migration code`)
        let messages: string[] = []

        migInfo.allLocalMigrations.forEach((l, index) => {
          let msg = ''
          if (index === allCloudMigrationTimestamps.length + Number(amount) - 1) {
            msg = `${l} ← apply target`
          } else if (index === allCloudMigrationTimestamps.length - 1) {
            msg = `${allCloudMigrationTimestamps[index]} ← cloud state`
          } else {
            msg = `${l}`
          }
          messages.push(msg)
        })

        console.log(boxen(messages.join('\n'), { padding: 1 }))
        const diff = await retrieveDiffCurrentTarget(atChildDbPath, currTargetSkipped.current, currTargetSkipped.target)
        const expressions = transformDiffToExpressions(diff)
        const migrCollection = await config.getMigrationCollection()
        query = await generateApplyQuery(
          expressions,
          currTargetSkipped.skipped,
          currTargetSkipped.target,
          migrCollection
        )
        printMessage(`${dbName} Generated migration code`)
      }

      const code = highlight(prettyPrintExpr(query), { language: 'clojure' })
      console.log(boxen(code, { padding: 1 }))

      printMessage(`${dbName} Applying migration`, 'info')
      await client.query(query)
      printMessage(`Done applying migrations`, 'success')
    } else {
      printMessage(`     ✅ Done, no migrations to apply`, 'success')
    }
  } catch (error) {
    const missingMigrDescription = isMissingMigrationCollectionFaunaError(error)
    if (missingMigrDescription) {
      printMessage(`The migrations collection is missing, \n did you run 'init' first?`, 'info')
      return
    }

    // This is the delaying part...
    const schemaDescription = isSchemaCachingFaunaError(error)
    if (schemaDescription) {
      printMessage(`Waiting for cache removal because of conflict`, 'info')
      printMessage(`This is the conflict:`)
      console.log(error)
      // Concatinate the error to a .fsm-error file in current working directory, creating the file if it doesn't exist.
      // Create a .fsm-error file in the current working directory if it does not exist
      const errorFile = path.join(process.cwd(), '.fsm-error')
      if (!fs.existsSync(errorFile)) {
        fs.writeFileSync(errorFile, '')
      }
      // Append the error to the file
      fs.appendFileSync(
        errorFile,
        ['', JSON.stringify(schemaDescription), '', JSON.stringify(error), '', ''].join('\n')
      )

      const dbName = atChildDbPath.length > 0 ? `[ DB: ROOT > ${atChildDbPath.join(' > ')} ]` : '[ DB: ROOT ]'
      // Nasty shit... erm... Todo: Tweak migrations / log which migrations contain a schema caching error?
      await new Promise((resolve) => setTimeout(resolve, 60000))
      printMessage(`${dbName} Applying migration`)
      await client.query(query)
      printMessage(`Applied migration`, 'success')
    } else {
      throw error
    }
  }
}

const validateNumber = (str: any) => {
  if (str !== 'all' && (isNaN(str) || isNaN(parseFloat(str)))) {
    throw new ExpectedNumberOfMigrations(str)
  }
}

export default apply
