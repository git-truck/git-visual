import type { Database } from "duckdb-async"
import { promises as fs } from "fs"
import { tableToIPC, tableFromJSON} from "apache-arrow"

const bundleSize = 5000

export abstract class Inserter<T> {
  protected rows: T[] = []
  public async addRow(row: T) {
    this.rows.push(row)
    if (this.rows.length >= bundleSize) await this.finalize()
  }

  public async addRows(rows: T[]) {
    this.rows.push(...rows)
    if (this.rows.length >= bundleSize) await this.finalize()
  }
  public abstract finalize(): Promise<void>

  constructor(protected table: string, protected db: Database) {}

  public static getSystemSpecificInserter<T>(table: string, tempPath: string, db: Database): Inserter<T> {
    return new JsonInserter<T>(table, tempPath, db)
    switch (process.platform) {
      case "darwin":
      case "linux":
        return new ArrowInserter<T>(table, db)
      default:
        return new JsonInserter<T>(table, tempPath, db)
    }
  }
}

class JsonInserter<T> extends Inserter<T> {
  private tempFile: string
  constructor(table: string, tempPath: string, db: Database) {
    super(table, db)
    this.tempFile = tempPath + table + ".json"
  }

  public async finalize() {
    if (this.rows.length < 1) return
    for (let i = 0; i < this.rows.length; i += bundleSize) {
      const sliced = this.rows.slice(i, i + bundleSize)
      await fs.writeFile(this.tempFile, JSON.stringify(sliced, (key, value) => {
        if (typeof value === "undefined") return null
        return value
      }))
      await this.db.exec(`INSERT INTO ${this.table} SELECT * FROM '${this.tempFile}'`)
      await fs.rm(this.tempFile)
    }
    
    this.rows = []
  }
}

class ArrowInserter<T> extends Inserter<T> {
  public async finalize() {
    if (this.rows.length < 1) return
    for (let i = 0; i < this.rows.length; i += bundleSize) {
      const sliced = this.rows.slice(i, i + bundleSize)
      // console.log("finalizing", this.table)
      // console.log("sliced", sliced)
      const arrowTable = tableFromJSON(sliced as Record<string, unknown>[])
      // console.log("data", arrowTable.data)
      // console.log("registering", this.table)
      await this.db.register_buffer(`temp_${this.table}`, [tableToIPC(arrowTable)], true)
      // console.log("done registering", this.table)
      await this.db.exec(`INSERT INTO ${this.table} BY NAME (SELECT * FROM temp_${this.table});`)
      // console.log("exec complete", this.table)
      await this.db.unregister_buffer(`temp_${this.table}`)
      // console.log("unregister", this.table)
    }
  }
}



// private typeToDuckdbType(val: unknown, key: string) {
//   switch (typeof val) {
//     case "number":
//       return "UINTEGER"
//     case "string":
//       return "VARCHAR"
//     case "bigint":
//       return "UBIGINT"
//     default:
//       if (key.includes("timestamp")) return "UINTEGER"
//       if (key.includes("name")) return "VARCHAR"
//       throw new Error("Unknown type " + key)
//   }
// }

// private objToDuckdbStruct(obj: Record<string | number | symbol, unknown>) {
//   const keys = Object.keys(obj)
//   const types: Record<string, string> = {}
//   for (const key of keys) {
//     const val = obj[key]
//     types[key] = this.typeToDuckdbType(val, key)
//   }
//   return types
// }


  // for (let i = 0; i < this.rows.length; i += bundleSize) {
  //   const sliced = this.rows.slice(i, i + bundleSize)
  //   const typesString = JSON.stringify(this.objToDuckdbStruct(this.rows[0]))
  //   const dataString = JSON.stringify(sliced).replace(/'/g, "")
  //   await this.db.exec(`
  //     insert into ${this.table} (select unnest(j, recursive:=true) from (select from_json('${dataString}', '[${typesString}]') j));
  //   `)
  // }