/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

import api from '../../../src/web/services/api'
import * as redis from '../../../src/web/services/redis'
import request from 'supertest'
import deploymentPackageQueue from '../../../src/web/services/generateDeploymentPackageQueue'

describe('POST /generateDeploymentPackage', () => {
  beforeAll(async () => {
    await redis.connect()
    deploymentPackageQueue.start(redis.client)
  })
  beforeEach(async () => {
    redis.client.flushall() // should only flush when before a test cache
  })
  it('should return 201 ACCEPTED and message id', async () => {
    const requestBody = {
      DeploymentChecklistFileId: 'defhij5678',
      AssessmentId: 'someAssessmentId',
      Namespace: 'someNamespace',
      OrgInfo: {
        Username: 'john@smith.com',
        OrgId: 'abcd1234',
        IsSandbox: true,
        InstanceUrl: 'https://some-company.my.salesforce.com',
        ApiVersion: '51.0',
      },
    }
    const response: request.Response = await request(api)
      .post('/generateDeploymentPackage')
      .send(requestBody)
    expect(response.status).toBe(201)
    expect(response.text.length).toBe(32)
  })
})
