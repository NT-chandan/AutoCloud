/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

import supertest from 'supertest'
import api from '../../../src/web/services/api'
import * as redis from '../../../src/web/services/redis'
import request from 'supertest'

describe('POST /metadata/read', () => {
  beforeAll(async () => {
    await redis.connect()
  })
  beforeEach(async () => {
    // redis.client.flushall() // should only flush when before a test cache
  })
  it('should return 200 OK and return metadata objects', async () => {
    const requestBody = {
      ComponentNames: ['Account', 'Contact'],
      ComponentType: 'CustomObject',
      OrgInfo: {
        Username: 'jason@zennify.com.fscupgrade.dev',
        OrgId: '00D4x000003vb62EAA',
        IsSandbox: true,
        InstanceUrl: 'https://fsc-upgrade-development-dev-ed.my.salesforce.com',
        ApiVersion: '51.0',
      },
    }
    const response: request.Response = await request(api)
      .post('/metadata/read')
      .send(requestBody)
    expect(response.status).toBe(200)
    expect(response.body['Account']).toEqual(expect.anything())
    expect(response.body['Contact']).toEqual(expect.anything())
  })
  it('missing request body should return 400 BAD REQUEST', async () => {
    const response: request.Response = await request(api).post('/metadata/read')
    expect(response.status).toBe(400)
    expect(response.body).toEqual({
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
        { msg: 'Invalid value', param: 'ComponentNames', location: 'body' },
        { msg: 'Invalid value', param: 'ComponentNames', location: 'body' },
        { msg: 'Invalid value', param: 'ComponentType', location: 'body' },
        { msg: 'Invalid value', param: 'ComponentType', location: 'body' },
      ],
    })
  })
})
