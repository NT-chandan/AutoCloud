/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

import request from 'supertest'
import api from '../../../src/web/services/api'
import * as redis from '../../../src/web/services/redis'

describe('POST /tooling/query', () => {
  beforeAll(async () => {
    await redis.connect()
  })
  beforeEach(async () => {
    redis.client.flushall()
  })
  it('should return 200 OK', () => {
    const requestBody = {
      Query: 'SELECT MetadataComponentId FROM MetadataComponentDependency',
      OrgInfo: {
        Username: 'jason@zennify.com.fscupgrade.dev',
        OrgId: '00D4x000003vb62EAA',
        IsSandbox: true,
        InstanceUrl: 'https://fsc-upgrade-development-dev-ed.my.salesforce.com',
        ApiVersion: '51.0',
      },
    }
    return request(api).post('/tooling/query').send(requestBody).expect(200)
  })
  it('missing request body should return 400 BAD REQUEST', () => {
    return request(api)
      .post('/tooling/query')
      .expect(400)
      .expect({
        errors: [
          { msg: 'Invalid value', param: 'OrgInfo.OrgId', location: 'body' },
          { msg: 'Invalid value', param: 'OrgInfo.OrgId', location: 'body' },
          { msg: 'Invalid value', param: 'OrgInfo.Username', location: 'body' },
          { msg: 'Invalid value', param: 'OrgInfo.Username', location: 'body' },
          {
            msg: 'Invalid value',
            param: 'OrgInfo.InstanceUrl',
            location: 'body',
          },
          {
            msg: 'Invalid value',
            param: 'OrgInfo.InstanceUrl',
            location: 'body',
          },
          { msg: 'Invalid value', param: 'Query', location: 'body' },
          { msg: 'Invalid value', param: 'Query', location: 'body' },
        ],
      })
  })
  it('OrgInfo.invalidUsername in request body should return 500 Internal Server Error', () => {
    const requestBody = {
      Query: 'SELECT MetadataComponentId FROM MetadataComponentDependency',
      OrgInfo: {
        Username: 'invalidUsername',
        OrgId: '00D4x000003vb62EAA',
        InstanceUrl: 'https://fsc-upgrade-development-dev-ed.my.salesforce.com',
        ApiVersion: '51.0',
      },
    }
    return request(api).post('/tooling/query').send(requestBody).expect(500)
  })
})
