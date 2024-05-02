/* Copyright (c) 2018, 2023, Oracle and/or its affiliates. */

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
 *   222. callTimeout.js
 *
 * DESCRIPTION
 *   Test "Connection.callTimeout" property.
 *   This test requries NODE_ORACLEDB_QA environment variable to be true.
 *   Because test cases use the hard-code variables TIME_OUT and
 *   DB_OP_TIME which are not stable in all network situations.
 *
 *****************************************************************************/
'use strict';

const oracledb  = require('oracledb');
const assert    = require('assert');
const dbConfig  = require('./dbconfig.js');
const testsUtil = require('./testsUtil.js');

describe('222. callTimeout.js', function() {

  let isRunnable = true;
  let conn;

  before(async function() {

    const isQA = dbConfig.test.NODE_ORACLEDB_QA;
    const prep = await testsUtil.checkPrerequisites();
    isRunnable = isQA && prep;
    if (!isRunnable) {
      this.skip();
    } else {
      conn = await oracledb.getConnection(dbConfig);
    }
  }); // before()

  after(async function() {
    if (!isRunnable) {
      return;
    } else {
      await conn.close();
    }
  });

  it('222.1 examples/calltimeout.js', async () => {
    const TIME_OUT = 2;
    const DB_OP_TIME = 4;

    conn.callTimeout = TIME_OUT * 1000;  // milliseconds

    await assert.rejects(
      async () => {
        await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [DB_OP_TIME]);
      },
      /NJS-123:/
    );

  }); // 222.1

  it('222.2 the timeout value is greater than the operation time', async () => {
    const TIME_OUT = 10;
    const DB_OP_TIME = 2;

    conn.callTimeout = TIME_OUT * 1000;  // milliseconds

    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [DB_OP_TIME]);
  }); // 222.2

  it('222.3 callTimeout is 0', async () => {
    const TIME_OUT = 0;
    const DB_OP_TIME = 2;

    conn.callTimeout = TIME_OUT;

    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [DB_OP_TIME]);
  }); // 222.3

  it('222.4 callTimeout is a negative value', function() {
    const TIME_OUT = -5;

    assert.throws(
      () => {
        conn.callTimeout = TIME_OUT;
      },
      /NJS-004:/
    );
  }); // 222.4

  it('222.5 callTimeout == NaN', function() {
    const TIME_OUT = NaN;

    assert.throws(
      () => {
        conn.callTimeout = TIME_OUT;
      },
      /NJS-004:/
    );
  });

  it('222.6 callTimeout is a String', function() {
    const TIME_OUT = 'foobar';

    assert.throws(
      () => {
        conn.callTimeout = TIME_OUT;
      },
      /NJS-004:/
    );
  });

  it('222.7 The callTimeout value applies not to the sum of all round-trips', async () => {
    const TIME_OUT = 4;

    conn.callTimeout = TIME_OUT * 1000;  // milliseconds

    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [2]);
    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [3]);
    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [2]);
  }); // 222.7

  it('222.8 The callTimeout value applies to each round-trip individually', async () => {
    const TIME_OUT = 2;
    const DB_OP_TIME = 4;

    conn.callTimeout = TIME_OUT * 1000;  // milliseconds

    await assert.rejects(
      async () => {
        await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [DB_OP_TIME]);
      },
      /NJS-123:/
    );

    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [1]);
    const result = await conn.execute(`SELECT (1+2) AS SUM FROM DUAL`);
    assert.strictEqual(3, result.rows[0][0]);
  });

  it('222.9 get the callTimeout value', async () => {
    const TIME_OUT = 10;
    const DB_OP_TIME = 2;

    //set the callTimeout
    conn.callTimeout = TIME_OUT * 1000;  // milliseconds

    // get and assert the set callTimeout
    assert.strictEqual(conn.callTimeout, TIME_OUT * 1000);
    await conn.execute(`BEGIN DBMS_SESSION.SLEEP(:sleepsec); END;`, [DB_OP_TIME]);
  });
});
