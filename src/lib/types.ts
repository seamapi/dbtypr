export interface Config {
  zapatos_dir: string
  output_dir: string
  customizable_tables?: Record<string, string[] | 'all'>
  reproduce_pgtui_bugs_for_tables?: Record<string, string[]>
  generate_knex_types?: boolean
  main_schema?: string
  file_header?: string
}

export interface DatabaseTree {
  schemas: Record<string, Schema>
}

export interface Schema {
  name: string
  tables: Record<string, Table>
}

export interface Table {
  name: string
  selectable_columns: Record<string, Column>
  insertable_columns: Record<string, Column>
  is_customizable: boolean
  is_affected_by_pgtui_bugs: boolean
  uses_zapatos_column_type: boolean
}

export interface Column {
  name: string
  type: string
  is_optional: boolean
  comments: string[]
}
