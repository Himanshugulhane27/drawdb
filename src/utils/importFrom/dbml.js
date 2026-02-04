import { Parser } from "@dbml/core";
import { arrangeTables } from "../arrangeTables";
import { Cardinality, Constraint } from "../../data/constants";
import { nanoid } from "nanoid";

const parser = new Parser();
const DEFAULT_TABLE_COLOR = "#175e7a";

/**
 * Converts DBML source code to diagram format
 * @param {string} src - DBML source code
 * @returns {Object} Parsed diagram with tables, enums, and relationships
 */
export function fromDBML(src) {
  const ast = parser.parse(src, "dbmlv2");

  const parsedTables = [];
  const parsedEnums = [];
  const parsedRelationships = [];

  for (const schema of ast.schemas) {
    for (const table of schema.tables) {
      if (!table.name) continue;
      
      let parsedTable = {};
      parsedTable.id = nanoid();
      parsedTable.name = table.name;
      parsedTable.comment = table.note ?? "";
      parsedTable.color = table.headerColor ?? DEFAULT_TABLE_COLOR;
      parsedTable.fields = [];
      parsedTable.indices = [];

      for (const column of table.fields) {
        if (!column.name) continue;
        
        const field = {};

        field.id = nanoid();
        field.name = column.name;
        field.type = column.type.type_name.toUpperCase();
        field.size = column.type.size ?? "";
        field.default = column.dbdefault?.value ?? "";
        field.check = "";
        field.primary = !!column.pk;
        field.unique = !!column.pk;
        field.notNull = !!column.not_null;
        field.increment = !!column.increment;
        field.comment = column.note ?? "";

        parsedTable.fields.push(field);
      }

      for (const idx of table.indexes) {
        const parsedIndex = {};

        parsedIndex.id = nanoid();
        parsedIndex.fields = idx.columns.map((x) => x.value);
        parsedIndex.name =
          idx.name ?? `${parsedTable.name}_idx_${parsedIndex.id}`;
        parsedIndex.unique = !!idx.unique;

        parsedTable.indices.push(parsedIndex);
      }

      parsedTables.push(parsedTable);
    }

    for (const ref of schema.refs) {
      if (!ref.endpoints || ref.endpoints.length < 2) continue;
      
      const startTableName = ref.endpoints[0].tableName;
      const endTableName = ref.endpoints[1].tableName;
      const startFieldName = ref.endpoints[0].fieldNames[0];
      const endFieldName = ref.endpoints[1].fieldNames[0];

      const startTable = parsedTables.find((t) => t.name === startTableName);
      if (!startTable) continue;

      const endTable = parsedTables.find((t) => t.name === endTableName);
      if (!endTable) continue;

      const endField = endTable.fields.find((f) => f.name === endFieldName);
      if (!endField) continue;

      const startField = startTable.fields.find(
        (f) => f.name === startFieldName,
      );
      if (!startField) continue;

      const relationship = {};

      relationship.name = `fk_${startTableName}_${startFieldName}_${endTableName}`;
      relationship.startTableId = startTable.id;
      relationship.endTableId = endTable.id;
      relationship.endFieldId = endField.id;
      relationship.startFieldId = startField.id;
      relationship.id = nanoid();

      relationship.updateConstraint = ref.onDelete
        ? ref.onDelete[0].toUpperCase() + ref.onDelete.substring(1)
        : Constraint.NONE;
      relationship.deleteConstraint = ref.onUpdate
        ? ref.onUpdate[0].toUpperCase() + ref.onUpdate.substring(1)
        : Constraint.NONE;

      const startRelation = ref.endpoints[0].relation;
      const endRelation = ref.endpoints[1].relation;

      if (startRelation === "*" && endRelation === "1") {
        relationship.cardinality = Cardinality.MANY_TO_ONE;
      }

      if (startRelation === "1" && endRelation === "*") {
        relationship.cardinality = Cardinality.ONE_TO_MANY;
      }

      if (startRelation === "1" && endRelation === "1") {
        relationship.cardinality = Cardinality.ONE_TO_ONE;
      }

      parsedRelationships.push(relationship);
    }

    for (const schemaEnum of schema.enums) {
      const parsedEnum = {};

      parsedEnum.id = nanoid();
      parsedEnum.name = schemaEnum.name;
      parsedEnum.values = schemaEnum.values.map((x) => x.name);

      parsedEnums.push(parsedEnum);
    }
  }

  const diagram = { tables: parsedTables, enums: parsedEnums, relationships: parsedRelationships };

  arrangeTables(diagram);

  return diagram;
}
