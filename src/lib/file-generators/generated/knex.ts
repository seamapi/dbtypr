import {
  type Project,
  type SourceFile,
  type StatementedNodeStructure,
  StructureKind,
} from 'ts-morph'

import type { Config, Schema } from '../../types.js'
import { pascalCase } from '../../utils.js'

export const createKnexIndexFile = (
  args: {
    project: Project
    schemas: Schema[]
  },
  config: Config,
): SourceFile => {
  const { project, schemas } = args
  const { output_dir, main_schema } = config

  const statements: StatementedNodeStructure['statements'] = []
  const module_interface_statements: StatementedNodeStructure['statements'] = []

  for (const schema of schemas) {
    if (Object.values(schema.tables).length === 0) continue

    statements.push({
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: `./${schema.name}`,
      namedImports: [
        {
          name: 'KnexSchemaTypeMap',
          alias: `${pascalCase(schema.name)}TypeMap`,
        },
      ],
    })

    if (schema.name === main_schema) {
      statements.push({
        kind: StructureKind.TypeAlias,
        name: `Prefixed${pascalCase(schema.name)}TypeMap`,
        type: `{ [K in keyof ${pascalCase(schema.name)}TypeMap as \`${schema.name}.\${K}\`]: ${pascalCase(schema.name)}TypeMap[K] }`,
        isExported: false,
      })
    }

    module_interface_statements.push({
      kind: StructureKind.Interface,
      name: 'Tables',
      extends: [`${pascalCase(schema.name)}TypeMap`],
      properties: [],
    })

    if (schema.name === main_schema) {
      module_interface_statements.push({
        kind: StructureKind.Interface,
        name: 'Tables',
        extends: [`Prefixed${pascalCase(schema.name)}TypeMap`],
        properties: [],
      })
    }
  }

  // Create the module declaration
  statements.push({
    kind: StructureKind.Module,
    name: `"knex/types/tables"`,
    hasDeclareKeyword: true,
    statements: module_interface_statements,
  })

  // Create the source file
  return project.createSourceFile(
    `${output_dir}/generated/knex.ts`,
    {
      statements,
    },
    { overwrite: true },
  )
}
