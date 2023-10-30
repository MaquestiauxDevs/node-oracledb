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
 *   250. rsGetAllRows2.js
 *
 * DESCRIPTION
 *   Test cases for getRows()/getRows(0) with nested cursor
 *
 *****************************************************************************/
'use strict';

const oracledb = require('oracledb');
const assert   = require('assert');
const dbConfig = require('./dbconfig.js');

describe('250. rsGetAllRows2.js', function() {
  let conn = null;
  const outFormatBak = oracledb.outFormat;
  const create_table_dept_sql =
    `BEGIN
       DECLARE
         e_table_missing EXCEPTION;
         PRAGMA EXCEPTION_INIT(e_table_missing, -00942);
       BEGIN
         EXECUTE IMMEDIATE ('DROP TABLE nodb_rsDept');
       EXCEPTION
         WHEN e_table_missing
         THEN NULL;
       END;
       EXECUTE IMMEDIATE ('
         CREATE TABLE nodb_rsDept (
           department_id NUMBER,
           department_name VARCHAR2(20)
         )'
       );
     END;`;

  const create_table_emp_sql =
    `BEGIN
       DECLARE
         e_table_missing EXCEPTION;
         PRAGMA EXCEPTION_INIT(e_table_missing, -00942);
       BEGIN
         EXECUTE IMMEDIATE ('DROP TABLE nodb_rsEmp');
       EXCEPTION
         WHEN e_table_missing
         THEN NULL;
       END;
       EXECUTE IMMEDIATE ('
         CREATE TABLE nodb_rsEmp (
           department_id NUMBER,
           employee_id   NUMBER,
           employee_name VARCHAR2(20)
         )'
       );
    END;`;
  const deptInsert = "INSERT INTO NODB_RSDEPT VALUES ( :1, :2)";
  const empInsert  = "INSERT INTO NODB_RSEMP VALUES (:1, :2, :3)";

  before(async function() {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    conn = await oracledb.getConnection(dbConfig);
    await conn.execute(create_table_dept_sql);
    await conn.execute(deptInsert, [101, "R&D"]);
    await conn.execute(deptInsert, [201, "Sales"]);
    await conn.execute(deptInsert, [301, "Marketing"]);

    await conn.execute(create_table_emp_sql);
    for (let i = 0; i < 127; i++) {
      await conn.execute(empInsert, [301, 1100 + i, "Marketing " + i ]);
    }
    await conn.execute(empInsert, [101, 1001, "R&D 1"]);
    await conn.commit();
  });

  after (async function() {
    oracledb.outFormat = outFormatBak;
    await conn.execute('DROP TABLE NODB_RSEMP PURGE');
    await conn.execute('DROP TABLE NODB_RSDEPT PURGE');
    await conn.close();
  });

  it('250.1 Nested Cursor + getRows() OBJECT outformat', async function() {
    const result = await conn.execute(
      `SELECT
        DEPARTMENT_NAME,
        CURSOR (
          SELECT
            EMPLOYEE_NAME,
            EMPLOYEE_ID
          FROM
            nodb_rsEmp B
          WHERE
            A.DEPARTMENT_ID = B.DEPARTMENT_ID
          ORDER BY EMPLOYEE_ID ) as NC
        FROM
          NODB_RSDEPT A`,
      {}, { resultSet: true }
    );

    const rows = await result.resultSet.getRows();

    // Top level
    assert.equal(rows.length, 3);
    assert.equal(rows[0].DEPARTMENT_NAME, "R&D");
    assert.equal(rows[1].DEPARTMENT_NAME, "Sales");
    assert.equal(rows[2].DEPARTMENT_NAME, "Marketing");

    // nested level
    let rs = rows[0].NC;
    let rows2 = await rs.getRows();
    assert.equal(rows2.length, 1);
    assert.equal(rows2[0].EMPLOYEE_NAME, "R&D 1");
    assert.equal(rows2[0].EMPLOYEE_ID, 1001);

    // Sales Dept - no employees.
    rs = rows[1].NC;
    rows2 = await rs.getRows();
    assert.equal(rows2.length, 0);

    rs = rows[2].NC;
    rows2 = await rs.getRows();
    assert.equal(rows2.length, 127);
    assert.equal(rows2[0].EMPLOYEE_NAME, "Marketing 0");
    assert.equal(rows2[1].EMPLOYEE_NAME, "Marketing 1");
    assert.equal(rows2[2].EMPLOYEE_NAME, "Marketing 2");
    assert.equal(rows2[126].EMPLOYEE_NAME, "Marketing 126");
    await result.resultSet.close();
  });

  it('250.2 Nested Cursor + getRows(0) rows ARRAY outformat', async function() {
    const result = await conn.execute(
      `SELECT
        DEPARTMENT_NAME,
        CURSOR (
          SELECT
            EMPLOYEE_NAME,
            EMPLOYEE_ID
          FROM
            nodb_rsEmp B
          WHERE
            A.DEPARTMENT_ID = B.DEPARTMENT_ID
          ORDER BY EMPLOYEE_ID ) as NC
      FROM
        NODB_RSDEPT A`,
      {}, { resultSet: true, outFormat: oracledb.OUT_FORMAT_ARRAY }
    );

    const rows = await result.resultSet.getRows(0);

    // Top level
    assert.equal(rows.length, 3);
    assert.equal(rows[0][0], "R&D");
    assert.equal(rows[1][0], "Sales");
    assert.equal(rows[2][0], "Marketing");

    // nested level
    let rs = rows[0][1];
    let rows2 = await rs.getRows(0);
    assert.equal(rows2.length, 1);
    assert.equal(rows2[0][0], "R&D 1");
    assert.equal(rows2[0][1], 1001);

    // Sales Dept - no employees.
    rs = rows[1][1];
    rows2 = await rs.getRows(0);
    assert.equal(rows2.length, 0);

    rs = rows[2][1];
    rows2 = await rs.getRows(0);
    assert.equal(rows2.length, 127) ;
    assert.equal(rows2[0][0], "Marketing 0");
    assert.equal(rows2[1][0], "Marketing 1");
    assert.equal(rows2[2][0], "Marketing 2");
    assert.equal(rows2[126][0], "Marketing 126");
    await result.resultSet.close();
    oracledb.outFormat = outFormatBak;
  });
  it('250.3 Nested Cursor + getRows(n) + getRows() OBJECT outformat', async function() {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    const result = await conn.execute(
      `SELECT
        DEPARTMENT_NAME,
        CURSOR (
          SELECT
            EMPLOYEE_NAME,
            EMPLOYEE_ID
          FROM
            nodb_rsEmp B
          WHERE
            A.DEPARTMENT_ID = B.DEPARTMENT_ID
          ORDER BY EMPLOYEE_ID ) as NC
        FROM
          NODB_RSDEPT A`,
      {}, { resultSet: true }
    );

    const rows1 = await result.resultSet.getRows(1);
    const rows2 = await result.resultSet.getRows();
    // Top level
    assert.equal(rows1.length, 1);
    assert.equal(rows2.length, 2);
    assert.equal(rows1[0].DEPARTMENT_NAME, "R&D");
    assert.equal(rows2[0].DEPARTMENT_NAME, "Sales");
    assert.equal(rows2[1].DEPARTMENT_NAME, "Marketing");

    // nested level
    let rs = rows1[0].NC;
    const rows1_NC = await rs.getRows();
    assert.equal(rows1_NC.length, 1);
    assert.equal(rows1_NC[0].EMPLOYEE_NAME, "R&D 1");
    assert.equal(rows1_NC[0].EMPLOYEE_ID, 1001);

    // Sales Dept - no employees.
    rs = rows2[0].NC;
    const rows2_NC = await rs.getRows();
    assert.equal(rows2_NC.length, 0);

    rs = rows2[1].NC;
    const rows2_NC1 = await rs.getRows(1);
    const rows2_NC2 = await rs.getRows();
    assert.equal(rows2_NC1.length, 1);
    assert.equal(rows2_NC2.length, 126);
    assert.equal(rows2_NC1[0].EMPLOYEE_NAME, "Marketing 0");
    assert.equal(rows2_NC2[0].EMPLOYEE_NAME, "Marketing 1");
    assert.equal(rows2_NC2[1].EMPLOYEE_NAME, "Marketing 2");
    assert.equal(rows2_NC2[125].EMPLOYEE_NAME, "Marketing 126");
    await result.resultSet.close();
  });

  it('250.4 Nested Cursor + getRow() + getRows(0) rows ARRAY outformat', async function() {
    oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;
    const result = await conn.execute(
      `SELECT
        DEPARTMENT_NAME,
        CURSOR (
          SELECT
            EMPLOYEE_NAME,
            EMPLOYEE_ID
          FROM
            nodb_rsEmp B
          WHERE
            A.DEPARTMENT_ID = B.DEPARTMENT_ID
          ORDER BY EMPLOYEE_ID ) as NC
      FROM
        NODB_RSDEPT A`,
      {}, { resultSet: true }
    );

    const rows1 = await result.resultSet.getRow();
    const rows2 = await result.resultSet.getRows(0);

    // Top level
    assert.equal(rows2.length, 2);
    assert.equal(rows1[0], "R&D");
    assert.equal(rows2[0][0], "Sales");
    assert.equal(rows2[1][0], "Marketing");

    // nested level
    let rs = rows1[1];
    const rows1_NC = await rs.getRows(0);
    assert.equal(rows1_NC.length, 1);
    assert.equal(rows1_NC[0][0], "R&D 1");
    assert.equal(rows1_NC[0][1], 1001);

    // Sales Dept - no employees.
    rs = rows2[0][1];
    const rows2_NC = await rs.getRows(0);
    assert.equal(rows2_NC.length, 0);

    rs = rows2[1][1];
    const rows2_NC1 = await rs.getRow();
    const rows2_NC2 = await rs.getRows(0);
    assert.equal(rows2_NC2.length, 126);
    assert.equal(rows2_NC1[0], "Marketing 0");
    assert.equal(rows2_NC2[0][0], "Marketing 1");
    assert.equal(rows2_NC2[1][0], "Marketing 2");
    assert.equal(rows2_NC2[125][0], "Marketing 126");
    await result.resultSet.close();
    oracledb.outFormat = outFormatBak;
  });

  it('250.5 Nested Cursor + getRows(n) + getRows(0) with fetchArraySize < remaining rows inside nested cursor', async function() {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    const result = await conn.execute(
      `SELECT
        DEPARTMENT_NAME,
        CURSOR (
          SELECT
            EMPLOYEE_NAME,
            EMPLOYEE_ID
          FROM
            nodb_rsEmp B
          WHERE
            A.DEPARTMENT_ID = B.DEPARTMENT_ID
          ORDER BY EMPLOYEE_ID ) as NC
        FROM
          NODB_RSDEPT A`,
      {}, { resultSet: true, fetchArraySize: 100 }
    );

    const rows1 = await result.resultSet.getRows(1);
    const rows2 = await result.resultSet.getRows(0);
    // Top level
    assert.equal(rows1.length, 1);
    assert.equal(rows2.length, 2);
    assert.equal(rows1[0].DEPARTMENT_NAME, "R&D");
    assert.equal(rows2[0].DEPARTMENT_NAME, "Sales");
    assert.equal(rows2[1].DEPARTMENT_NAME, "Marketing");

    // nested level
    let rs = rows1[0].NC;
    const rows1_NC = await rs.getRows(0);
    assert.equal(rows1_NC.length, 1);
    assert.equal(rows1_NC[0].EMPLOYEE_NAME, "R&D 1");
    assert.equal(rows1_NC[0].EMPLOYEE_ID, 1001);

    // Sales Dept - no employees.
    rs = rows2[0].NC;
    const rows2_NC = await rs.getRows(0);
    assert.equal(rows2_NC.length, 0);

    rs = rows2[1].NC;
    const rows2_NC1 = await rs.getRows(1);
    const rows2_NC2 = await rs.getRows(0);
    assert.equal(rows2_NC1.length, 1);
    assert.equal(rows2_NC2.length, 126);
    assert.equal(rows2_NC1[0].EMPLOYEE_NAME, "Marketing 0");
    assert.equal(rows2_NC2[0].EMPLOYEE_NAME, "Marketing 1");
    assert.equal(rows2_NC2[125].EMPLOYEE_NAME, "Marketing 126");
    await result.resultSet.close();
  });

  it('250.6 Nested Cursor + getRows(n) + getRow() + getRows() with fetchArraySize = 1', async function() {
    const result = await conn.execute(
      `SELECT
        DEPARTMENT_NAME,
        CURSOR (
          SELECT
            EMPLOYEE_NAME,
            EMPLOYEE_ID
          FROM
            nodb_rsEmp B
          WHERE
            A.DEPARTMENT_ID = B.DEPARTMENT_ID
          ORDER BY EMPLOYEE_ID ) as NC
        FROM
          NODB_RSDEPT A`,
      {}, { resultSet: true, fetchArraySize: 1 }
    );

    const rows1 = await result.resultSet.getRows(1);
    const rows2 = await result.resultSet.getRows();
    // Top level
    assert.equal(rows1.length, 1);
    assert.equal(rows2.length, 2);
    assert.equal(rows1[0].DEPARTMENT_NAME, "R&D");
    assert.equal(rows2[0].DEPARTMENT_NAME, "Sales");
    assert.equal(rows2[1].DEPARTMENT_NAME, "Marketing");

    // nested level
    let rs = rows1[0].NC;
    const rows1_NC = await rs.getRows();
    assert.equal(rows1_NC.length, 1);
    assert.equal(rows1_NC[0].EMPLOYEE_NAME, "R&D 1");
    assert.equal(rows1_NC[0].EMPLOYEE_ID, 1001);

    // Sales Dept - no employees.
    rs = rows2[0].NC;
    const rows2_NC = await rs.getRows();
    assert.equal(rows2_NC.length, 0);

    rs = rows2[1].NC;
    const rows2_NC1 = await rs.getRow();
    const rows2_NC2 = await rs.getRows();
    assert.equal(rows2_NC2.length, 126);
    assert.equal(rows2_NC1.EMPLOYEE_NAME, "Marketing 0");
    assert.equal(rows2_NC2[125].EMPLOYEE_NAME, "Marketing 126");
    await result.resultSet.close();
  });

});
