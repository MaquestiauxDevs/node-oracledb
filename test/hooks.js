/* Copyright (c) 2023, Oracle and/or its affiliates. */

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
 *   hooks.js
 *
 * DESCRIPTION
 *   This file contains the global hooks for running the Mocha test suite. It
 * verifies the database configuration before running the test suite in order
 * to avoid unusual errors. It also sets up information about the database
 * (such as whether the database is running in a cloud service or not) which
 * may be used in the test suite.
 *
 *****************************************************************************/

const oracledb = require('oracledb');
const dbConfig = require('./dbconfig.js');
const assert = require('assert');

async function testConnection(description, additionalOptions = {}) {
  console.log(description);

  const credential = {...dbConfig, ...additionalOptions};
  const connection = await oracledb.getConnection(credential);
  const result = await connection.execute(
    "select * from dual", [], { outFormat: oracledb.OUT_FORMAT_ARRAY });
  assert.strictEqual(result.rows[0][0], "X");
  await connection.close();
}

/*
 * This is to skip tests that are not supported by Oracle Connection Manager in Traffic Director mode.
 */
async function cmanTdmCheck() {
  const connection = await oracledb.getConnection(dbConfig);
  const result = await connection.execute(`select sys_context('USERENV','PROXY_USER') from dual`);
  if (!process.env.NODE_ORACLEDB_PROXY_SESSION_USER && result.rows[0][0] != null) {
    dbConfig.test.isCmanTdm = true;
  }
  await connection.close();
}

async function cloudServiceCheck() {
  const connection = await oracledb.getConnection(dbConfig);
  // 'userenv' parameter is only available from Oracle DB 18c & later versions
  if (connection.oracleServerVersion >= 1800000000) {
    const result = await connection.execute("select \
     sys_context('userenv', 'cloud_service') from dual");
    if (result.rows[0][0]) {
      dbConfig.test.isCloudService = true;
    }
  }
  await connection.close();
}

before(async function() {
  await testConnection("Regular connection");
  if (dbConfig.test.DBA_PRIVILEGE) {
    await testConnection("DBA connection", {user: dbConfig.test.DBA_user, password: dbConfig.test.DBA_password, privilege: oracledb.SYSDBA});
  }
  if (dbConfig.test.externalAuth) {
    await testConnection("External auth", {externalAuth: true});
  }
  if (dbConfig.test.proxySessionUser) {
    await testConnection("Proxy Session User", {user: `${dbConfig.user}[${dbConfig.test.proxySessionUser}]`});
  }
  await cloudServiceCheck();
  await cmanTdmCheck();
});
