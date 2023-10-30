/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. */

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
 *   249. rsGetAllRows1.js
 *
 * DESCRIPTION
 *   Test cases for getRows()/getRows(0)
 *
 *****************************************************************************/
'use strict';

const oracledb = require('oracledb');
const assert   = require('assert');
const dbConfig = require('./dbconfig.js');

describe('249. rsGetAllRows1.js', function() {
  let conn = null;
  const tableName = "nodb_rsgetRows";
  const outFormatBak = oracledb.outFormat;
  const create_table_sql =
    `BEGIN
      DECLARE
        e_table_missing EXCEPTION;
        PRAGMA EXCEPTION_INIT(e_table_missing, -00942);
      BEGIN
        EXECUTE IMMEDIATE ('DROP TABLE ` + tableName + ` ');
      EXCEPTION
        WHEN e_table_missing
        THEN NULL;
      END;
      EXECUTE IMMEDIATE ('
        CREATE TABLE ` + tableName + ` (
          obj_id NUMBER,
          obj_name VARCHAR2(20)
        )
      ');
    END;`;
  const rsSelect = "SELECT obj_id, obj_name from " + tableName;
  const rsInsert =
    `DECLARE
       i NUMBER;
       name VARCHAR2(20);
     BEGIN
       FOR i IN 1..150 LOOP
         name := 'Object ' || i;
         INSERT INTO ` + tableName + ` VALUES (i, name);
       END LOOP;
     END; `;
  const rsProc =
     `CREATE OR REPLACE PROCEDURE nodb_rsgetRowsOut
        (p_out OUT SYS_REFCURSOR) AS
      BEGIN
        OPEN p_out FOR SELECT * FROM ` + tableName + ` ORDER BY OBJ_ID;
      END;`;

  before (async function() {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    conn = await oracledb.getConnection(dbConfig);
    await conn.execute(create_table_sql);
    await conn.execute(rsInsert);
    await conn.execute(rsProc);
    await conn.commit();
  });

  after (async function() {
    oracledb.outFormat = outFormatBak;
    await conn.execute("DROP PROCEDURE nodb_rsgetRowsOut");
    await conn.execute("DROP TABLE " + tableName + " PURGE");
    await conn.close();
  });

  describe('249.1 ResultSet & getRows()', function() {
    it('249.1.1 ResultSet + getRows()', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true});
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.1.2 ResultSet + getRows(0)', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true});
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[99].OBJ_ID, 100);
      assert.equal(rows[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.1.3 ResultSet + getRows(125) + getRows()', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, outFormat: oracledb.OUT_FORMAT_ARRAY });
      await result.resultSet.getRows(125);
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 25);
      assert.equal(rows[0][0], 126);
      assert.equal(rows[24][0], 150);
      await result.resultSet.close();

    });

    it('249.1.4 ResultSet + getRows(125) + getRows(0)', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true});
      await result.resultSet.getRows(125);
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.1.5 ResultSet + getRow() + getRows()', async function() {

      const result = await conn.execute(rsSelect, {}, { resultSet: true, outFormat: oracledb.OUT_FORMAT_ARRAY });
      await result.resultSet.getRow();
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 149);
      assert.equal(rows[0][0], 2);
      assert.equal(rows[148][0], 150);
      await result.resultSet.close ();

    });

    it('249.1.6 ResultSet + getRow() + getRows(0)', async function() {

      const result = await conn.execute(rsSelect, {}, { resultSet: true });
      await result.resultSet.getRow();
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await result.resultSet.close ();

    });
  });

  describe('249.2 REFCURSOR & getRows()', function() {
    it('249.2.1 RefCursor getRows()', async function() {

      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds);
      const rs = results.outBinds.out;
      const rows = await rs.getRows();

      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await rs.close();

    });

    it('249.2.2 RefCursor + getRows(0) ', async function() {

      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds);
      const rs = results.outBinds.out;
      const rows = await rs.getRows(0);

      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await rs.close();

    });

    it('249.2.3 RefCursor + getRows(125) & getRows()', async function() {

      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds);
      const rs = results.outBinds.out;
      await rs.getRows(125);
      const rows = await rs.getRows();
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await rs.close();

    });

    it('249.2.4 RefCursor + getRows(125) & getRows(0)',  async function() {

      const results = await conn.execute(
        "BEGIN nodb_rsgetRowsOut ( :out ); END;",
        { out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT} });
      const rs = results.outBinds.out;
      await rs.getRows(125);
      const rows = await rs.getRows(0);
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await rs.close();

    });

    it('249.2.5 RefCursor + getRow() & getRows()',  async function() {

      const results = await conn.execute(
        "BEGIN nodb_rsgetRowsOut ( :out ); END;",
        { out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT} });
      const rs = results.outBinds.out;
      await rs.getRow();
      const rows = await rs.getRows();
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await rs.close();

    });

    it('249.2.6 RefCursor + getRow() & getRows(0)',  async function() {

      const results = await conn.execute(
        "BEGIN nodb_rsgetRowsOut ( :out ); END;",
        { out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT} });
      const rs = results.outBinds.out;
      await rs.getRow();
      const rows = await rs.getRows(0);
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await rs.close();

    });
  });

  describe('249.3 ResultSet & getRows() with fetchArraySize', function() {
    it('249.3.1 ResultSet + getRows() with fetchArraySize = total rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 150 });
      const rows1 = await result.resultSet.getRows();
      const rows2 = await result.resultSet.getRows();
      assert.equal(rows1.length, 150);
      assert.equal(rows2.length, 0);
      assert.equal(rows1[0].OBJ_ID, 1);
      assert.equal(rows1[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.2 ResultSet + getRows(0) with fetchArraySize = total rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 150 });
      const rows1 = await result.resultSet.getRows(0);
      const rows2 = await result.resultSet.getRows(0);
      assert.equal(rows1.length, 150);
      assert.equal(rows2.length, 0);
      assert.equal(rows1[0].OBJ_ID, 1);
      assert.equal(rows1[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.3 ResultSet + getRows() with fetchArraySize > total rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 200 });
      const rows1 = await result.resultSet.getRows();
      const rows2 = await result.resultSet.getRows();
      assert.equal(rows1.length, 150);
      assert.equal(rows2.length, 0);
      assert.equal(rows1[0].OBJ_ID, 1);
      assert.equal(rows1[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.4 ResultSet + getRows(0) with fetchArraySize > total rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 200 });
      const rows1 = await result.resultSet.getRows(0);
      const rows2 = await result.resultSet.getRows(0);
      assert.equal(rows1.length, 150);
      assert.equal(rows2.length, 0);
      assert.equal(rows1[0].OBJ_ID, 1);
      assert.equal(rows1[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.5 ResultSet + getRows() with fetchArraySize < total rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 100 });
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await result.resultSet.close();
    });

    it('249.3.6 ResultSet + getRows(0) with fetchArraySize < total rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 100 });
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.7 ResultSet + getRows(125) + getRows() with fetchArraySize > remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 30 });
      await result.resultSet.getRows(125);
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.8 ResultSet + getRows(125) + getRows(0) with fetchArraySize > remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 30 });
      await result.resultSet.getRows(125);
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.9 ResultSet + getRows(125) + getRows() with fetchArraySize < remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 20 });
      await result.resultSet.getRows(125);
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.10 ResultSet + getRows(125) + getRows(0) with fetchArraySize < remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, {resultSet: true, fetchArraySize: 20 });
      await result.resultSet.getRows(125);
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await result.resultSet.close();

    });

    it('249.3.11 ResultSet + getRow() + getRows() with fetchArraySize > remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, { resultSet: true, fetchArraySize: 200 });
      await result.resultSet.getRow();
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await result.resultSet.close ();
    });

    it('249.3.12 ResultSet + getRow() + getRows(0) with fetchArraySize > remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, { resultSet: true, fetchArraySize: 200 });
      await result.resultSet.getRow();
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await result.resultSet.close ();

    });

    it('249.3.13 ResultSet + getRow() + getRows() with fetchArraySize < remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, { resultSet: true, fetchArraySize: 100 });
      await result.resultSet.getRow();
      const rows = await result.resultSet.getRows();
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await result.resultSet.close ();

    });

    it('249.3.14 ResultSet + getRow() + getRows(0) with fetchArraySize < remaining rows', async function() {

      const result = await conn.execute(rsSelect, {}, { resultSet: true, fetchArraySize: 100 });
      await result.resultSet.getRow();
      const rows = await result.resultSet.getRows(0);
      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await result.resultSet.close ();

    });
  });

  describe('249.4 REFCURSOR & getRows() with fetchArraySize', function() {
    it('249.4.1 RefCursor getRows() with fetchArraySize > total rows', async function() {

      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds, { fetchArraySize: 200 });
      const rs = results.outBinds.out;
      const rows = await rs.getRows();

      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await rs.close();

    });

    it('249.4.2 RefCursor + getRows(0) with fetchArraySize > total rows', async function() {

      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds, { fetchArraySize: 200 });
      const rs = results.outBinds.out;
      const rows = await rs.getRows(0);

      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[1].OBJ_ID, 2);
      assert.equal(rows[149].OBJ_ID, 150);
      await rs.close();
    });

    it('249.4.3 RefCursor getRows() with fetchArraySize < total rows', async function() {
      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds, { fetchArraySize: 100 });
      const rs = results.outBinds.out;
      const rows = await rs.getRows();

      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[149].OBJ_ID, 150);
      await rs.close();
    });

    it('249.4.4 RefCursor + getRows(0) with fetchArraySize < total rows', async function() {

      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds, { fetchArraySize: 100 });
      const rs = results.outBinds.out;
      const rows = await rs.getRows(0);

      assert.equal(rows.length, 150);
      assert.equal(rows[0].OBJ_ID, 1);
      assert.equal(rows[149].OBJ_ID, 150);
      await rs.close();
    });

    it('249.4.5 RefCursor + getRows(125) & getRows() with fetchArraySize < remaining rows', async function() {
      const sql = "BEGIN nodb_rsgetRowsOut ( :out ); END;";
      const binds = {out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT}};
      const results = await conn.execute(sql, binds, { fetchArraySize: 20 });
      const rs = results.outBinds.out;
      await rs.getRows(125);
      const rows = await rs.getRows();

      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await rs.close();
    });

    it('249.4.6 RefCursor + getRows(125) & getRows(0) with fetchArraySize < remaining rows',  async function() {
      const results = await conn.execute(
        "BEGIN nodb_rsgetRowsOut ( :out ); END;",
        { out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT} }, { fetchArraySize: 20 });
      const rs = results.outBinds.out;
      await rs.getRows(125);
      const rows = await rs.getRows(0);

      assert.equal(rows.length, 25);
      assert.equal(rows[0].OBJ_ID, 126);
      assert.equal(rows[24].OBJ_ID, 150);
      await rs.close();
    });

    it('249.4.7 RefCursor + getRow() & getRows() with fetchArraySize < remaining rows',  async function() {

      const results = await conn.execute(
        "BEGIN nodb_rsgetRowsOut ( :out ); END;",
        { out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT} }, { fetchArraySize: 100 });
      const rs = results.outBinds.out;
      await rs.getRow();
      const rows = await rs.getRows();

      assert.equal(rows.length, 149);
      assert.equal(rows[0].OBJ_ID, 2);
      assert.equal(rows[148].OBJ_ID, 150);
      await rs.close();

    });

    it('249.4.8 RefCursor + getRow() & getRows(0) with fetchArraySize < remaining rows',  async function() {

      const results = await conn.execute(
        "BEGIN nodb_rsgetRowsOut ( :out ); END;",
        { out: {type: oracledb.CURSOR, dir: oracledb.BIND_OUT} }, { fetchArraySize: 100, outFormat: oracledb.OUT_FORMAT_ARRAY });
      const rs = results.outBinds.out;
      await rs.getRow();
      const rows = await rs.getRows(0);

      assert.equal(rows.length, 149);
      assert.equal(rows[0][0], 2);
      assert.equal(rows[148][0], 150);
      await rs.close();
    });
  });
});
