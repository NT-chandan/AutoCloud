/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

import request from 'supertest'
import api from '../../../src/web/services/api'

describe('GET /', () => {
  it('should return 200 OK', () => {
    return request(api).get('/').expect(200)
  })
})
