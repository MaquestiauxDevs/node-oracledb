/* Copyright (c) 2019, 2023, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * This software is dual-licensed to you under the Universal Permissive License
 * (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
 * 2.0 as shown at https://www.apache.org/licenses/LICENSE-2.0. You may choose
 * either license.
 *
 * If you elect to accept the software under the Apache License, Version 2.0,
 * the following applies:
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   200. dbObject1.js
 *
 * DESCRIPTION
 *   Test the Oracle data type Object on VARCHAR2 and NUMBER.
 *
 *****************************************************************************/
'use strict';

const oracledb  = require('oracledb');
const assert    = require('assert');
const dbConfig  = require('./dbconfig.js');
const testsUtil = require('./testsUtil.js');

describe('200. dbObject1.js', () => {

  let conn;
  const TYPE = 'NODB_TYP_OBJ_1';
  const TABLE  = 'NODB_TAB_OBJ1';

  const proc1 =
    `create or replace procedure nodb_getDataCursor1(p_cur out sys_refcursor) is
      begin
        open p_cur for
          SELECT
            * FROM
            ${TABLE}
        WHERE num >= 108;
      end; `;

  const proc2 =
    `create or replace procedure nodb_getDataCursor2(p_cur out sys_refcursor) is
       begin
         open p_cur for
           SELECT
             * FROM
             ${TABLE}
         WHERE num >= 300;
       end; `;

  const proc3 =
      `create or replace procedure nodb_getDataCursor3(
          p_cur1 out sys_refcursor,
          p_cur2 out sys_refcursor
       ) is
       begin
         nodb_getDataCursor1(p_cur1);
         nodb_getDataCursor2(p_cur2);
       end;`;

  before(async () => {
    conn = await oracledb.getConnection(dbConfig);

    let sql =
      `CREATE OR REPLACE TYPE ${TYPE} AS OBJECT (
        id NUMBER,
        name VARCHAR2(30),
        address VARCHAR2(1024)
      );`;
    await conn.execute(sql);

    sql =
      `CREATE TABLE ${TABLE} (
        num NUMBER,
        person ${TYPE}
      )`;
    const plsql = testsUtil.sqlCreateTable(TABLE, sql);
    await conn.execute(plsql);
  }); // before()

  after(async () => {
    let sql = `DROP TABLE ${TABLE} PURGE`;
    await conn.execute(sql);

    sql = `DROP TYPE ${TYPE}`;
    await conn.execute(sql);

    await conn.execute(`DROP PROCEDURE nodb_getDataCursor3`);
    await conn.execute(`DROP PROCEDURE nodb_getDataCursor2`);
    await conn.execute(`DROP PROCEDURE nodb_getDataCursor1`);

    await conn.close();
  }); // after()

  it('200.1 insert an object with numeric/string values', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const objData = {
      ID: 201,
      NAME: 'Christopher Jones'
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 101;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.strictEqual(result.rows[0][1]['ID'], objData.ID);
    assert.strictEqual(result.rows[0][1]['NAME'], objData.NAME);
  }); // 200.1

  it('200.2 insert an object with null numeric values', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const objData = {
      ID: null,
      NAME: 'Christopher Jones'
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 102;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.strictEqual(result.rows[0][1]['ID'], null);
    assert.strictEqual(result.rows[0][1]['NAME'], objData.NAME);
  }); // 200.2

  it('200.3 insert an object with null string values', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const objData = {
      ID: 203,
      NAME: null
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 103;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.strictEqual(result.rows[0][1]['ID'], objData.ID);
    assert.strictEqual(result.rows[0][1]['NAME'], null);
  }); // 200.3

  it('200.4 insert an object with undefined numeric values', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const objData = {
      ID: undefined,
      NAME: 'Christopher Jones'
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 104;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.strictEqual(result.rows[0][1]['ID'], null);
    assert.strictEqual(result.rows[0][1]['NAME'], objData.NAME);
  }); // 200.4

  it('200.5 insert an object with undefined string values', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const objData = {
      ID: 205,
      NAME: undefined
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 105;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.strictEqual(result.rows[0][1]['ID'], objData.ID);
    assert.strictEqual(result.rows[0][1]['NAME'], null);
  }); // 200.5

  it('200.6 insert an empty object - no attributes', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const objData = { };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 106;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.ifError(result.rows[0][1]['ID']);
    assert.ifError(result.rows[0][1]['NAME']);
  }); // 200.6

  it('200.7 insert data via binding by object', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:a, :b)`;
    const objData = {
      ID: 207,
      NAME: 'Christopher Jones'
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 107;

    let result = await conn.execute(sql, { a: seq, b: testObj });
    assert.strictEqual(result.rowsAffected, 1);
    await conn.commit();

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql, [], { outFormat: oracledb.OBJECT });

    assert.strictEqual(result.rows[0].NUM, seq);
    assert.strictEqual(result.rows[0].PERSON['ID'], objData.ID);
    assert.strictEqual(result.rows[0].PERSON.NAME, objData.NAME);
  }); // 200.7

  it('200.8 insert multiple rows using executeMany() with inferred data type', async () => {
    const objClass = await conn.getDbObjectClass(TYPE);
    let initialID = 208;
    const initialSeq = 108;

    const objDataArray = [
      {
        ID: initialID,
        NAME: 'Christopher Jones'
      },
      {
        ID: initialID++,
        NAME: 'Changjie Lin'
      },
      {
        ID: initialID++,
        NAME: 'Anthony Tuininga'
      }
    ];
    const bindArray = [];
    let seq, objDataObj;
    for (let i = 0; i < objDataArray.length; i++) {
      seq = initialSeq + i;
      objDataObj = new objClass(objDataArray[i]);
      bindArray[i] = { a: seq, b: objDataObj };
    }

    const options = { autoCommit: true };
    let sql = `INSERT INTO ${TABLE} VALUES (:a, :b)`;

    let result = await conn.executeMany(sql, bindArray, options);
    assert.strictEqual(result.rowsAffected, objDataArray.length);

    sql = `SELECT * FROM ${TABLE} WHERE num >= ${initialSeq}`;
    result = await conn.execute(sql);

    for (let j = 0; j < objDataArray.length; j++) {
      assert.strictEqual(result.rows[j][0], (initialSeq + j));
      assert.strictEqual(result.rows[j][1]['ID'], objDataArray[j].ID);
      assert.strictEqual(result.rows[j][1].NAME, objDataArray[j].NAME);
    }
  }); // 200.8

  it('200.9 insert multiple rows using executeMany() with explicit data type', async () => {
    const objClass = await conn.getDbObjectClass(TYPE);
    let initialID = 3000;
    const initialSeq = 300;

    const objDataArray = [
      {
        ID: initialID,
        NAME: 'Christopher Jones'
      },
      {
        ID: initialID++,
        NAME: 'Changjie Lin'
      },
      {
        ID: initialID++,
        NAME: 'Anthony Tuininga'
      }
    ];
    const bindArray = [];
    let seq, objDataObj;
    for (let i = 0; i < objDataArray.length; i++) {
      seq = initialSeq + i;
      objDataObj = new objClass(objDataArray[i]);
      bindArray[i] = { a: seq, b: objDataObj };
    }

    const options = {
      autoCommit: true,
      bindDefs: { a: { type: oracledb.NUMBER}, b: { type: objClass }  }
    };
    let sql = `INSERT INTO ${TABLE} VALUES (:a, :b)`;

    let result = await conn.executeMany(sql, bindArray, options);
    assert.strictEqual(result.rowsAffected, objDataArray.length);

    sql = `SELECT * FROM ${TABLE} WHERE num >= ${initialSeq}`;
    result = await conn.execute(sql);

    for (let j = 0; j < objDataArray.length; j++) {
      assert.strictEqual(result.rows[j][0], (initialSeq + j));
      assert.strictEqual(result.rows[j][1]['ID'], objDataArray[j].ID);
      assert.strictEqual(result.rows[j][1].NAME, objDataArray[j].NAME);
    }
  }); // 200.9

  it('200.10 call procedure with 2 OUT binds of DbObject', async function() {
    await conn.execute(proc1);
    await conn.execute(proc2);
    await conn.execute(proc3);

    const result = await conn.execute(
      `BEGIN nodb_getDataCursor3(p_cur1 => :p_cur1,
          p_cur2 => :p_cur2); end;`,
      {
        p_cur1: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT},
        p_cur2: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}
      }
    );

    let resultSet = await result.outBinds.p_cur1.getRows();
    assert.equal(resultSet.length, 6);
    result.outBinds.p_cur1.close();

    resultSet = await result.outBinds.p_cur2.getRows();
    assert.equal(resultSet.length, 3);
    result.outBinds.p_cur2.close();
  }); // 200.10;

  it('200.11 insert an object with large string values', async () => {
    let sql = `INSERT INTO ${TABLE} VALUES (:1, :2)`;
    const maxLen = 1024;
    const largeString = 'A'.repeat(maxLen);
    const objData = {
      ADDRESS: largeString
    };
    const objClass = await conn.getDbObjectClass(TYPE);
    const testObj = new objClass(objData);
    const seq = 111;

    let result = await conn.execute(sql, [seq, testObj]);
    assert.strictEqual(result.rowsAffected, 1);

    sql = `SELECT * FROM ${TABLE} WHERE num = ${seq}`;
    result = await conn.execute(sql);

    assert.strictEqual(result.rows[0][0], seq);
    assert.strictEqual(result.rows[0][1]['ADDRESS'], objData.ADDRESS);
  }); // 200.11

});

describe('200.2 Number property with Precision', function() {
  let conn;
  const TYPE_SMALL_PRECISION = 'NODB_TYP_OBJ_1_SPREC';
  const TYPE_LARGE_PRECISION = 'NODB_TYP_OBJ_1_LPREC';
  const typ1 =
    `create or replace type ${TYPE_SMALL_PRECISION} as object (TESTNUMBER number (12, 0))`;
  const typ2 =
    `create or replace type ${TYPE_LARGE_PRECISION} as object (TESTNUMBER number (22, 0))`;

  before(async () => {
    conn = await oracledb.getConnection(dbConfig);
    await conn.execute(typ1);
    await conn.execute(typ2);
  }); // before()

  after(async () => {
    let sql = `DROP TYPE ${TYPE_SMALL_PRECISION}`;
    await conn.execute(sql);
    sql = `DROP TYPE ${TYPE_LARGE_PRECISION}`;
    await conn.execute(sql);
    await conn.close();
  }); // after()

  async function runPlSQL(sql, typ) {
    const inpVal = 260;
    const result = await conn.execute(sql, {
      arg: {
        dir: oracledb.BIND_INOUT,
        type: typ,
        val: {'TESTNUMBER': inpVal}
      }
    }, {outFormat: oracledb.OUT_FORMAT_OBJECT});
    return result;
  }

  it('200.2.1 using small Precision', async () => {
    const retVal = 560;
    const sql = `declare myType ${TYPE_SMALL_PRECISION} := :arg; begin myType.TESTNUMBER := ${retVal};
      :arg := myType; end;`;

    const result = await runPlSQL(sql, TYPE_SMALL_PRECISION);
    assert.strictEqual(result.outBinds.arg.TESTNUMBER, retVal);
  });

  it('200.2.2 using Large Precision', async () => {
    const retVal = 560;
    const sql = `declare myType ${TYPE_LARGE_PRECISION} := :arg; begin myType.TESTNUMBER := ${retVal};
      :arg := myType; end;`;

    const result = await runPlSQL(sql, TYPE_LARGE_PRECISION);
    assert.strictEqual(result.outBinds.arg.TESTNUMBER, retVal);
  });

});
