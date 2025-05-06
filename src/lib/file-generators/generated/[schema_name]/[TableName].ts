import {
  type Project,
  type SourceFile,
  type StatementedNodeStructure,
  StructureKind,
} from 'ts-morph'

import type { Config, Schema, Table } from '../../../types.js'
import { pascalCase } from '../../../utils.js'

export const createResultingTypeFile = (
  args: {
    project: Project
    schema: Schema
    table: Table
  },
  config: Config,
): SourceFile => {
  const { project, schema, table } = args
  const { output_dir } = config

  const pascal_table_name = pascalCase(table.name)

  const statements: StatementedNodeStructure['statements'] = [
    {
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: `./${pascal_table_name}QueryTypes`,
      namedImports: [
        `Selectable${pascal_table_name}`,
        `Insertable${pascal_table_name}`,
      ],
      isTypeOnly: true,
    },
  ]

  if (table.is_affected_by_pgtui_bugs) {
    statements.push({
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: '../utils',
      namedImports: ['ReproducePgtuiBugs'],
      isTypeOnly: true,
    })
  }

  if (table.is_customizable) {
    statements.push(
      {
        kind: StructureKind.ImportDeclaration,
        moduleSpecifier: '../utils',
        namedImports: ['CustomizeDbType', 'CustomizeDbTypeInitializer'],
        isTypeOnly: true,
      },
      {
        kind: StructureKind.ImportDeclaration,
        moduleSpecifier: `../../custom/${schema.name}/${pascal_table_name}CustomTypes`,
        defaultImport: `${pascal_table_name}CustomTypes`,
        isTypeOnly: true,
      },
    )
  }

  statements.push(
    (writer) => writer.newLine(),
    {
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: pascal_table_name,
      type: table.is_customizable
        ? `CustomizeDbType<Selectable${pascal_table_name}, ${pascal_table_name}CustomTypes>`
        : `Selectable${pascal_table_name}`,
    },
    {
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: `${pascal_table_name}Initializer`,
      type: table.is_customizable
        ? `CustomizeDbTypeInitializer<Insertable${pascal_table_name}, ${pascal_table_name}CustomTypes>`
        : `Insertable${pascal_table_name}`,
    },
  )

  if (table.is_affected_by_pgtui_bugs) {
    statements.push({
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: `${pascal_table_name}WithPgtuiBugs`,
      type: `ReproducePgtuiBugs<${pascal_table_name}>`,
      docs: [
        {
          description: `@deprecated Reproduces type bugs from the legacy \`pgtui\` library and should not be used in new code.\n\nSpecifically:\n- Columns ending in \`_id\` are incorrectly typed as \`string\`, regardless of their actual database type.\n- \`jsonb\` columns are typed as \`any\` instead of a more specific type.`,
        },
      ],
    })
    statements.push({
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: `${pascal_table_name}InitializerWithPgtuiBugs`,
      type: `ReproducePgtuiBugs<${pascal_table_name}Initializer>`,
      docs: [
        {
          description: `@deprecated Reproduces type bugs from the legacy \`pgtui\` library and should not be used in new code.\n\nSpecifically:\n- Columns ending in \`_id\` are incorrectly typed as \`string\`, regardless of their actual database type.\n- \`jsonb\` columns are typed as \`any\` instead of a more specific type.`,
        },
      ],
    })
  }

  return project.createSourceFile(
    `${output_dir}/generated/${schema.name}/${pascal_table_name}.ts`,
    { statements },
    { overwrite: true },
  )
}
