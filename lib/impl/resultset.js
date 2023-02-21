// Copyright (c) 2022, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// You may not use the identified files except in compliance with the Apache
// License, Version 2.0 (the "License.")
//
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------

'use strict';

const ConnectionImpl = require('./connection.js');
const errors = require('../util.js');

// define implementation class
class ResultSetImpl {

  //---------------------------------------------------------------------------
  // _getConnImpl()
  //
  // Common method on all classes that make use of a connection -- used to
  // ensure serialization of all use of the connection.
  //---------------------------------------------------------------------------
  _getConnImpl() {
    let parentObj = this._parentObj;
    while (!(parentObj instanceof ConnectionImpl))
      parentObj = parentObj._parentObj;
    return parentObj;
  }

  //---------------------------------------------------------------------------
  // close()
  //
  // Closes the result set.
  //---------------------------------------------------------------------------
  close() {
    errors.throwNotImplemented("closing a result set");
  }

  //---------------------------------------------------------------------------
  // getMetaData()
  //
  // Returns the metadata from the result set.
  //---------------------------------------------------------------------------
  getMetaData() {
    errors.throwNotImplemented("getting metadata");
  }

  //---------------------------------------------------------------------------
  // getRows()
  //
  // Returns rows from a result set.
  //---------------------------------------------------------------------------
  getRows() {
    errors.throwNotImplemented("getting rows");
  }

}

module.exports = ResultSetImpl;