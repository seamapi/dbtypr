import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import test from 'ava'

import { generateTypes } from '@seamapi/dbtypr'

const zapatos_schema = `
declare module 'zapatos/schema' {
  import type * as db from 'zapatos/db'

  export namespace public {
    export namespace users {
      export type Table = 'users'
      export interface Selectable {
        user_id: string
        name: string | null
        metadata: db.JSONValue
        created_at: Date
      }
      export interface Insertable {
        user_id?: string | db.Parameter<string> | db.DefaultType | db.SQLFragment
        name?: string | db.Parameter<string> | null | db.DefaultType | db.SQLFragment
        metadata: db.JSONValue | db.Parameter<db.JSONValue> | db.SQLFragment
        created_at?: (db.TimestampTzString | Date) | db.Parameter<(db.TimestampTzString | Date)> | db.DefaultType | db.SQLFragment
      }
    }
  }

  export namespace other {
    export namespace things {
      export type Table = 'things'
      export interface Selectable {
        thing_id: string
      }
      export interface Insertable {
        thing_id?: string | db.Parameter<string> | db.DefaultType | db.SQLFragment
      }
    }
  }
}
`

const generate = async (generate_knex_types: boolean) => {
  const dir = await mkdtemp(join(tmpdir(), 'dbtypr-test-'))
  try {
    const zapatos_dir = join(dir, 'zapatos')
    const output_dir = join(dir, 'output')
    await mkdir(zapatos_dir)
    await writeFile(join(zapatos_dir, 'schema.d.ts'), zapatos_schema)

    await generateTypes({
      zapatos_dir,
      output_dir,
      main_schema: 'public',
      customizable_tables: { public: ['users'] },
      reproduce_pgtui_bugs_for_tables: { public: ['users'] },
      generate_knex_types,
    })

    const files: Record<string, string> = {}
    for (const entry of await readdir(output_dir, { recursive: true })) {
      const path = join(output_dir, entry)
      if (!entry.endsWith('.ts')) continue
      files[relative(output_dir, path)] = await readFile(path, 'utf-8')
    }
    return Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('generateTypes: generate_knex_types true', async (t) => {
  const files = await generate(true)
  t.true(Object.keys(files).includes(join('generated', 'knex.ts')))
  t.snapshot(files)
})

test('generateTypes: generate_knex_types false', async (t) => {
  const files = await generate(false)
  t.false(Object.keys(files).includes(join('generated', 'knex.ts')))
  for (const [path, content] of Object.entries(files)) {
    t.false(/knex/i.test(content), `${path} references Knex`)
  }
  t.snapshot(files)
})
