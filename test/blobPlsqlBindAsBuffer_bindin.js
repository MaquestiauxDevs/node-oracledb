/* Copyright (c) 2016, 2023, Oracle and/or its affiliates. */

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
 *   77. blobPlsqlBindAsBuffer_bindin.js
 *
 * DESCRIPTION
 *   Testing BLOB binding in as Buffer.
 *
 *****************************************************************************/
'use strict';

const oracledb = require('oracledb');
const assert   = require('assert');
const fs       = require('fs');
const dbConfig = require('./dbconfig.js');
const random   = require('./random.js');

describe('77. blobPlsqlBindAsBuffer_bindin.js', function() {

  let connection = null;
  let insertID = 1; // assume id for insert into db starts from 1

  const proc_blob_in_tab = "BEGIN \n" +
                         "    DECLARE \n" +
                         "        e_table_missing EXCEPTION; \n" +
                         "        PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \n" +
                         "    BEGIN \n" +
                         "        EXECUTE IMMEDIATE('DROP TABLE nodb_tab_blob_in PURGE'); \n" +
                         "    EXCEPTION \n" +
                         "        WHEN e_table_missing \n" +
                         "        THEN NULL; \n" +
                         "    END; \n" +
                         "    EXECUTE IMMEDIATE (' \n" +
                         "        CREATE TABLE nodb_tab_blob_in ( \n" +
                         "            id      NUMBER, \n" +
                         "            blob_1  BLOB, \n" +
                         "            blob_2  BLOB \n" +
                         "        ) \n" +
                         "    '); \n" +
                         "END; ";

  const proc_lobs_in_tab = "BEGIN \n" +
                         "    DECLARE \n" +
                         "        e_table_missing EXCEPTION; \n" +
                         "        PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \n" +
                         "    BEGIN \n" +
                         "        EXECUTE IMMEDIATE('DROP TABLE nodb_tab_lobs_in PURGE'); \n" +
                         "    EXCEPTION \n" +
                         "        WHEN e_table_missing \n" +
                         "        THEN NULL; \n" +
                         "    END; \n" +
                         "    EXECUTE IMMEDIATE (' \n" +
                         "        CREATE TABLE nodb_tab_lobs_in ( \n" +
                         "            id    NUMBER, \n" +
                         "            blob  BLOB \n" +
                         "        ) \n" +
                         "    '); \n" +
                         "END; ";

  before(async function() {
    connection = await oracledb.getConnection(dbConfig);
    await setupAllTable();
  }); // before

  after(async function() {
    await dropAllTable();
    await connection.close();
  }); // after

  const setupAllTable = async function() {
    await connection.execute(proc_blob_in_tab);
    await connection.execute(proc_lobs_in_tab);
  };

  const dropAllTable = async function() {
    await connection.execute("DROP TABLE nodb_tab_blob_in PURGE");
    await connection.execute("DROP TABLE nodb_tab_lobs_in PURGE");
  };

  const executeSQL = async function(sql) {
    await connection.execute(sql);
  };

  const jpgFileName = './test/fuzzydinosaur.jpg';

  const prepareTableWithBlob = async function(sql, id) {
    const bindVar = {
      i: id,
      lobbv: { type: oracledb.BLOB, dir: oracledb.BIND_OUT }
    };
    const result = await connection.execute(sql, bindVar);
    assert.strictEqual(result.rowsAffected, 1);
    assert.strictEqual(result.outBinds.lobbv.length, 1);

    const inStream = fs.createReadStream(jpgFileName);
    const lob = result.outBinds.lobbv[0];

    await new Promise((resolve, reject) => {
      lob.on('error', reject);
      inStream.on('error', reject);
      lob.on('finish', resolve);
      inStream.pipe(lob);
    });
    await connection.commit();
  };

  const verifyBlobValueWithFileData = async function(selectSql) {
    const result = await connection.execute(selectSql);
    const lob = result.rows[0][0];
    const blobData = await lob.getData();
    const originalData = await fs.promises.readFile(jpgFileName);
    assert.deepStrictEqual(originalData, blobData);
    lob.destroy();
  };

  const verifyBlobValueWithBuffer = async function(selectSql, originalBuffer, specialStr) {
    const result = await connection.execute(selectSql);
    const lob = result.rows[0][0];
    if (originalBuffer == null || originalBuffer == undefined) {
      assert.ifError(lob);
    } else {
      const blobData = await lob.getData();
      if (originalBuffer.length === 0) {
        assert.strictEqual(blobData, null);
      } else {
        const specStrLength = specialStr.length;
        assert.strictEqual(blobData.toString('utf8', 0, specStrLength),
          specialStr);
        assert.strictEqual(blobData.toString('utf8',
          (blobData.length - specStrLength), blobData.length), specialStr);
        assert.deepStrictEqual(blobData, originalBuffer);
      }
      lob.destroy();
    }
  };

  describe('77.1 BLOB, PLSQL, BIND_IN', function() {
    const proc = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_771 (blob_id IN NUMBER, blob_in IN BLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, blob_in); \n" +
               "END nodb_blobs_in_771; ";
    const sqlRun = "BEGIN nodb_blobs_in_771 (:i, :b); END;";
    const proc_drop = "DROP PROCEDURE nodb_blobs_in_771";

    const proc_7711 = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_7711 (blob_id IN NUMBER, blob_in IN BLOB)\n" +
                    "AS \n" +
                    "BEGIN \n" +
                    "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, EMPTY_BLOB()); \n" +
                    "END nodb_blobs_in_7711; ";
    const sqlRun_7711 = "BEGIN nodb_blobs_in_7711 (:i, :b); END;";
    const proc_drop_7711 = "DROP PROCEDURE nodb_blobs_in_7711";

    before(async function() {
      await executeSQL(proc);
    }); // before

    after(async function() {
      await executeSQL(proc_drop);
    }); // after

    it('77.1.1 works with EMPTY_BLOB', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7711);

      await connection.execute(sqlRun_7711, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      const emptyBuffer =  Buffer.from("", "utf-8");
      await verifyBlobValueWithBuffer(sql, emptyBuffer, null);

      await executeSQL(proc_drop_7711);
    }); // 77.1.1

    it('77.1.2 works with EMPTY_BLOB and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7711);

      await connection.execute(sqlRun_7711, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      const emptyBuffer =  Buffer.from("", "utf-8");
      await verifyBlobValueWithBuffer(sql, emptyBuffer, null);

      await executeSQL(proc_drop_7711);
    }); // 77.1.2

    it('77.1.3 works with EMPTY_BLOB and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7711);

      await connection.execute(sqlRun_7711, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      const emptyBuffer =  Buffer.from("", "utf-8");
      await verifyBlobValueWithBuffer(sql, emptyBuffer, null);

      await executeSQL(proc_drop_7711);
    }); // 77.1.3

    it('77.1.4 works with null', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.4

    it('77.1.5 works with null and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.5

    it('77.1.6 works with null and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };


      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.6

    it('77.1.7 works with empty buffer', async function() {
      const sequence = insertID++;
      const bufferStr =  Buffer.from('', "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.7

    it('77.1.8 works with empty buffer and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bufferStr = Buffer.from('', "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };


      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.8

    it('77.1.9 works with empty buffer and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bufferStr = Buffer.from('', "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };


      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.9

    it('77.1.10 works with undefined', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.10

    it('77.1.11 works with undefined and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.11

    it('77.1.12 works with undefined and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.1.12

    it('77.1.13 works with NaN', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: NaN, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.1.13

    it('77.1.14 works with 0', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: 0, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.1.14

    it('77.1.15 works with Buffer size 32K', async function() {
      // Driver already supports CLOB AS STRING and BLOB AS BUFFER for PLSQL BIND if the data size less than or equal to 32767.
      // As part of this enhancement, driver allows even if data size more than 32767 for both column types
      const sequence = insertID++;
      const size = 32768;
      const specialStr = "77.1.15";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.15

    it('77.1.16 works with Buffer size (64K - 1)', async function() {
      const size = 65535;
      const sequence = insertID++;
      const specialStr = "77.1.16";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.16

    it('77.1.17 works with Buffer size (64K + 1)', async function() {
      const size = 65537;
      const sequence = insertID++;
      const specialStr = "77.1.17";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.17

    it('77.1.18 works with Buffer size (1MB + 1)', async function() {
      const size = 1048577; // 1 * 1024 * 1024 + 1
      const sequence = insertID++;
      const specialStr = "77.1.18";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.18

    it('77.1.19 works with bind value and type mismatch', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: 200, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 50000 }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.1.19

    it('77.1.20 mixing named with positional binding', async function() {
      const size = 50000;
      const sequence = insertID++;
      const specialStr = "77.1.20";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = [ sequence, { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size } ];
      const option = { autoCommit: true };

      const sqlRun_77122 = "BEGIN nodb_blobs_in_771 (:1, :2); END;";
      await connection.execute(sqlRun_77122, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.20

    it('77.1.21 works with invalid BLOB', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: {}, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 50000 }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.1.21

    it('77.1.22 works without maxSize', async function() {
      const size = 65535;
      const sequence = insertID++;
      const specialStr = "77.1.22";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.22

    it('77.1.23 works with bind in maxSize smaller than buffer size', async function() {
      const size = 65535;
      const sequence = insertID++;
      const specialStr = "77.1.23";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size - 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.1.23

    it('77.1.24 works with UPDATE', async function() {
      const proc_7726 = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_7726 (blob_id IN NUMBER, blob_in IN BLOB, blob_update IN BLOB)\n" +
                      "AS \n" +
                      "BEGIN \n" +
                      "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, blob_in); \n" +
                      "    update nodb_tab_blob_in set blob_1 = blob_update where id = blob_id; \n" +
                      "END nodb_blobs_in_7726; ";
      const sqlRun_7726 = "BEGIN nodb_blobs_in_7726 (:i, :b1, :b2); END;";
      const proc_drop_7726 = "DROP PROCEDURE nodb_blobs_in_7726";
      const sequence = insertID++;
      const size_1 = 65535;
      const specialStr_1 = "77.1.24_1";
      const bigStr_1 = random.getRandomString(size_1, specialStr_1);
      const bufferStr_1 = Buffer.from(bigStr_1, "utf-8");
      const size_2 = 30000;
      const specialStr_2 = "77.1.24_2";
      const bigStr_2 = random.getRandomString(size_2, specialStr_2);
      const bufferStr_2 = Buffer.from(bigStr_2, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
        b2: { val: bufferStr_2, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_2 }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7726);

      await connection.execute(
        sqlRun_7726,
        bindVar,
        option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr_2, specialStr_2);

      await executeSQL(proc_drop_7726);
    }); // 77.1.24
  }); // 77.1

  describe('77.2 BLOB, PLSQL, BIND_IN to RAW', function() {
    const proc = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_771 (blob_id IN NUMBER, blob_in IN RAW)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, blob_in); \n" +
               "END nodb_blobs_in_771; ";
    const sqlRun = "BEGIN nodb_blobs_in_771 (:i, :b); END;";
    const proc_drop = "DROP PROCEDURE nodb_blobs_in_771";

    const proc_7721 = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_7721 (blob_id IN NUMBER, blob_in IN RAW)\n" +
                    "AS \n" +
                    "BEGIN \n" +
                    "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, EMPTY_BLOB()); \n" +
                    "END nodb_blobs_in_7721; ";
    const sqlRun_7721 = "BEGIN nodb_blobs_in_7721 (:i, :b); END;";
    const proc_drop_7721 = "DROP PROCEDURE nodb_blobs_in_7721";

    before(async function() {
      await executeSQL(proc);
    }); // before

    after(async function() {
      await executeSQL(proc_drop);
    }); // after

    it('77.2.1 works with EMPTY_BLOB', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7721);

      await connection.execute(sqlRun_7721, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      const emptyBuffer = Buffer.from("", "utf-8");
      await verifyBlobValueWithBuffer(sql, emptyBuffer, null);

      await executeSQL(proc_drop_7721);
    }); // 77.2.1

    it('77.2.2 works with EMPTY_BLOB and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7721);

      await connection.execute(sqlRun_7721, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      const emptyBuffer = Buffer.from("", "utf-8");
      await verifyBlobValueWithBuffer(sql, emptyBuffer, null);

      await executeSQL(proc_drop_7721);
    }); // 77.2.2

    it('77.2.3 works with EMPTY_BLOB and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7721);

      await connection.execute(sqlRun_7721, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      const emptyBuffer = Buffer.from("", "utf-8");
      await verifyBlobValueWithBuffer(sql, emptyBuffer, null);

      await executeSQL(proc_drop_7721);
    }); // 77.2.3

    it('77.2.4 works with null', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.4

    it('77.2.5 works with null and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.5

    it('77.2.6 works with null and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.6

    it('77.2.7 works with empty buffer', async function() {
      const sequence = insertID++;
      const bufferStr = Buffer.from('', "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.7

    it('77.2.8 works with empty buffer and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bufferStr = Buffer.from('', "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.8

    it('77.2.9 works with empty buffer and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bufferStr = Buffer.from('', "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.9

    it('77.2.10 works with undefined', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.10

    it('77.2.11 works with undefined and bind in maxSize set to 1', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.11

    it('77.2.12 works with undefined and bind in maxSize set to (64K - 1)', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 65535 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, null, null);
    }); // 77.2.12

    it('77.2.13 works with NaN', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: NaN, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.2.13

    it('77.2.14 works with 0', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: 0, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.2.14

    it('77.2.15 works with Buffer size (32K - 1)', async function() {
      const sequence = insertID++;
      const size = 32767;
      const specialStr = "77.2.15";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.2.15

    it('77.2.16 works with Buffer size 32K', async function() {
      const size = 32768;
      const sequence = insertID++;
      const specialStr = "77.2.16";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar),
        /ORA-06502:/
      );
    }); // 77.2.16

    it('77.2.17 works with invalid BLOB', async function() {
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: {}, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: 50000 }
      };
      const options = { autoCommit: true };
      await assert.rejects(
        async () => await connection.execute(sqlRun, bindVar, options),
        /NJS-011:/
      );
    }); // 77.2.17

    it('77.2.18 works without maxSize', async function() {
      const size = 3000;
      const sequence = insertID++;
      const specialStr = "77.2.18";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.2.18

    it('77.2.19 works with bind in maxSize smaller than buffer size', async function() {
      const size = 400;
      const sequence = insertID++;
      const specialStr = "77.2.19";
      const bigStr = random.getRandomString(size, specialStr);
      const bufferStr = Buffer.from(bigStr, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size - 1 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr, specialStr);
    }); // 77.2.19

    it('77.2.20 works with UPDATE', async function() {
      const proc_7720 = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_7720 (blob_id IN NUMBER, blob_in IN RAW, blob_update IN RAW)\n" +
                      "AS \n" +
                      "BEGIN \n" +
                      "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, blob_in); \n" +
                      "    update nodb_tab_blob_in set blob_1 = blob_update where id = blob_id; \n" +
                      "END nodb_blobs_in_7720; ";
      const sqlRun_7720 = "BEGIN nodb_blobs_in_7720 (:i, :b1, :b2); END;";
      const proc_drop_7720 = "DROP PROCEDURE nodb_blobs_in_7720";
      const sequence = insertID++;
      const size_1 = 3000;
      const specialStr_1 = "77.2.20_1";
      const bigStr_1 = random.getRandomString(size_1, specialStr_1);
      const bufferStr_1 = Buffer.from(bigStr_1, "utf-8");
      const size_2 = 2000;
      const specialStr_2 = "77.2.20_2";
      const bigStr_2 = random.getRandomString(size_2, specialStr_2);
      const bufferStr_2 = Buffer.from(bigStr_2, "utf-8");
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
        b2: { val: bufferStr_2, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_2 }
      };
      const option = { autoCommit: true };

      await executeSQL(proc_7720);

      await connection.execute(
        sqlRun_7720,
        bindVar,
        option);

      const sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql, bufferStr_2, specialStr_2);

      await executeSQL(proc_drop_7720);
    }); // 77.2.20

  }); // 77.2

  describe('77.3 Multiple BLOBs, BIND_IN', function() {
    const proc = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_774 (blob_id IN NUMBER, blob_1 IN BLOB, blob_2 IN BLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_blob_in (id, blob_1, blob_2) values (blob_id, blob_1, blob_2); \n" +
               "END nodb_blobs_in_774; ";
    const sqlRun = "BEGIN nodb_blobs_in_774 (:i, :b1, :b2); END;";
    const proc_drop = "DROP PROCEDURE nodb_blobs_in_774";

    before(async function() {
      await executeSQL(proc);
    }); // before

    after(async function() {
      await executeSQL(proc_drop);
    }); // after

    it('77.3.1 bind two Buffer', async function() {
      const size_1 = 32768;
      const size_2 = 50000;
      const specialStr_1 = "77.3.1_1";
      const specialStr_2 = "77.3.1_2";
      const bigStr_1 = random.getRandomString(size_1, specialStr_1);
      const bigStr_2 = random.getRandomString(size_2, specialStr_2);
      const bufferStr_1 = Buffer.from(bigStr_1, "utf-8");
      const bufferStr_2 = Buffer.from(bigStr_2, "utf-8");
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
        b2: { val: bufferStr_2, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_2 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql_1 = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql_1, bufferStr_1, specialStr_1);

      const sql_2 = "select blob_2 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql_2, bufferStr_2, specialStr_2);
    }); // 77.3.1

    it('77.3.2 bind a JPG file and a Buffer', async function() {
      const specialStr = "77.3.2";
      const preparedCLOBID = 301;
      const sequence = insertID++;
      const size_1 = 32768;
      const bigStr_1 = random.getRandomString(size_1, specialStr);
      const bufferStr_1 = Buffer.from(bigStr_1, "utf-8");
      let result = null;

      const sql = "INSERT INTO nodb_tab_lobs_in (id, blob) VALUES (:i, EMPTY_BLOB()) RETURNING blob INTO :lobbv";
      await prepareTableWithBlob(sql, preparedCLOBID);

      result = await connection.execute(
        "select blob from nodb_tab_lobs_in where id = :id",
        { id: preparedCLOBID });

      assert.notEqual(result.rows.length, 0);

      const blob = result.rows[0][0];
      await connection.execute(
        sqlRun,
        {
          i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
          b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
          b2: { val: blob, type: oracledb.BLOB, dir: oracledb.BIND_IN }
        },
        { autoCommit: true });
      blob.destroy();

      const sql_1 = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql_1, bufferStr_1, specialStr);

      const sql_2 = "select blob_2 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithFileData(sql_2);
    }); // 77.3.2

    it('77.3.3 bind two Buffer, one > (64K - 1)', async function() {
      const size_1 = 65538;
      const size_2 = 50000;
      const specialStr_1 = "77.3.3_1";
      const specialStr_2 = "77.3.3_2";
      const bigStr_1 = random.getRandomString(size_1, specialStr_1);
      const bigStr_2 = random.getRandomString(size_2, specialStr_2);
      const bufferStr_1 = Buffer.from(bigStr_1, "utf-8");
      const bufferStr_2 = Buffer.from(bigStr_2, "utf-8");
      const sequence = insertID++;
      const bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
        b2: { val: bufferStr_2, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_2 }
      };
      const option = { autoCommit: true };

      await connection.execute(sqlRun, bindVar, option);

      const sql_1 = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql_1, bufferStr_1, specialStr_1);

      const sql_2 = "select blob_2 from nodb_tab_blob_in where id = " + sequence;
      await verifyBlobValueWithBuffer(sql_2, bufferStr_2, specialStr_2);
    }); // 77.3.3

  }); // 77.3

});
