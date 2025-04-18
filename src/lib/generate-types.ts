import prettier from 'prettier'
import { Project, type SourceFile } from 'ts-morph'

import { createCustomTypesFile } from './file-generators/custom/[schema_name]/[TableName]CustomTypes.js'
import { createResultingTypeFile } from './file-generators/generated/[schema_name]/[TableName].js'
import { createQueryTypesFile } from './file-generators/generated/[schema_name]/[TableName]QueryTypes.js'
import { createSchemaGeneratedTypeIndexFile } from './file-generators/generated/[schema_name]/index.js'
import { createGeneratedIndexFile } from './file-generators/generated/index.js'
import { createKnexIndexFile } from './file-generators/generated/knex.js'
import { createKyselyIndexFile } from './file-generators/generated/kysely.js'
import { createGeneratedUtilsFile } from './file-generators/generated/utils.js'
import { readDatabaseTree } from './read-database-tree.js'
import type { Config, DatabaseTree } from './types.js'

/**
 * Generate types based on a Zapatos database schema.
 */
export const generateTypes = async (config: Config) => {
  const project = new Project()
  const database_tree = readDatabaseTree(config)

  createGeneratedTypesFiles(project, database_tree, config)
  createCustomTypesFiles(project, database_tree, config)

  await formatProjectFiles(project)

  project.saveSync()
}

const createGeneratedTypesFiles = (
  project: Project,
  database_tree: DatabaseTree,
  config: Config,
) => {
  const {
    file_header = '// @generated\n// This file was automatically generated. DO NOT EDIT!\n\n',
  } = config

  const schemas = Object.values(database_tree.schemas)
  const generated_types_files: SourceFile[] = [
    createKyselyIndexFile({ project, schemas }, config),
    createGeneratedIndexFile({ project, schemas }, config),
    createGeneratedUtilsFile({ project }, config),
  ]

  if (config.generate_knex_types === true) {
    generated_types_files.push(
      createKnexIndexFile({ project, schemas }, config),
    )
  }

  for (const schema of schemas) {
    for (const table of Object.values(schema.tables)) {
      generated_types_files.push(
        createQueryTypesFile({ project, schema, table }, config),
        createResultingTypeFile({ project, schema, table }, config),
      )
    }
    if (Object.values(schema.tables).length > 0) {
      generated_types_files.push(
        createSchemaGeneratedTypeIndexFile({ project, schema }, config),
      )
    }
  }

  for (const source_file of generated_types_files) {
    source_file.replaceWithText(`${file_header}${source_file.getFullText()}`)
  }

  return generated_types_files
}

const createCustomTypesFiles = (
  project: Project,
  database_tree: DatabaseTree,
  config: Config,
) => {
  const custom_types_files: SourceFile[] = []
  for (const schema of Object.values(database_tree.schemas)) {
    for (const table of Object.values(schema.tables)) {
      if (!table.is_customizable) {
        continue
      }
      try {
        custom_types_files.push(
          createCustomTypesFile({ project, schema, table }, config),
        )
      } catch (error: any) {
        if (error.message.includes('A source file already exists') === true) {
          continue
        }
        throw error as Error
      }
    }
  }
  return custom_types_files
}

const formatProjectFiles = async (project: Project) => {
  for (const source_file of project.getSourceFiles()) {
    const formatted_source = await prettier.format(
      source_file.getFullText().replace(/;$/gm, ''),
      {
        semi: false,
        parser: 'typescript',
      },
    )
    source_file.replaceWithText(formatted_source)
  }
}
