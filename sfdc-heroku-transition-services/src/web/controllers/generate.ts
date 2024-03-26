import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { PdfContent, XlsxContent } from '../../types/generateDocument'
import logger from '../../util/logger'
import xlsx from 'node-xlsx'
import { OrgInfo } from '../services/api'
import pdfQueue from '../services/pdfQueue'
import { SALESFORCE_API_VERSION } from '../../util/secrets'
import generateDeploymentPackageQueue from '../services/generateDeploymentPackageQueue'

export enum GenerateDocumentType {
  PDF = 'PDF',
  XLSX = 'XLSX',
}

interface GenerateDocumentRequestBody {
  Content: XlsxContent | PdfContent
  AnalysisDocumentId: string
  Type: GenerateDocumentType
  Url?: string
  AssessmentId?: string
  Namespace?: string
  OrgInfo: OrgInfo
}

interface GenerateDeploymentPackageRequestBody {
  DeploymentChecklistFileId: string
  AssessmentId?: string
  Namespace?: string
  OrgInfo: OrgInfo
}

// Converts a json obj of interface XlsxContent to an array buffer
const jsonToXlsxBuffer = (Content: XlsxContent): ArrayBuffer => {
  const worksheets: {
    name: string
    data: unknown[][]
    options?: { '!cols': { wch?: number }[] }
  }[] = Content.Sheets.map((worksheet) => ({
    name: worksheet.Name,
    data: [
      worksheet.Columns.map((column) => column.Name),
      ...worksheet.DataRows,
    ],
    options: {
      '!cols': worksheet.Columns.map((column) => ({ wch: column.Width })),
    },
  }))
  // Convert worksheets structure to buffer
  return xlsx.build(worksheets)
}

export const postDocument = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  try {
    const {
      body: {
        Type,
        Content,
        AnalysisDocumentId,
        Url,
        Namespace,
        OrgInfo: { OrgId, Username, IsSandbox, InstanceUrl },
        AssessmentId,
      },
    } = req as Request<unknown, unknown, GenerateDocumentRequestBody>
    const ApiVersion: string =
      req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
    switch (Type) {
      case GenerateDocumentType.PDF: {
        const messageId = await new Promise((resolve, reject) =>
          pdfQueue.client.send(
            JSON.stringify({
              OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox, ApiVersion },
              AssessmentId,
              Url,
              Content,
              AnalysisDocumentId,
              Namespace,
              RequestId: req.id,
            }),
            (err, id) => {
              if (err) reject(err)
              resolve(id)
            },
          ),
        )
        return res.status(202).send(messageId)
      }
      case GenerateDocumentType.XLSX: {
        const buffer = jsonToXlsxBuffer(Content as XlsxContent)
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        return res.send(buffer)
      }
      default:
        logger.error('Invalid GenerateDocumentType')
    }
    return res.send()
  } catch (error) {
    next(error)
  }
}

export const postDeploymentPackage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  try {
    const {
      body: {
        DeploymentChecklistFileId,
        Namespace,
        AssessmentId,
        OrgInfo: { OrgId, Username, IsSandbox, InstanceUrl },
      },
    } = req as Request<unknown, unknown, GenerateDeploymentPackageRequestBody>

    const ApiVersion: string =
      req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
    const messageId = await new Promise((resolve, reject) =>
      generateDeploymentPackageQueue.client.send(
        JSON.stringify({
          DeploymentChecklistFileId,
          Namespace,
          AssessmentId,
          OrgInfo: { OrgId, Username, IsSandbox, InstanceUrl, ApiVersion },
          RequestId: req.id,
        }),
        (err, id) => {
          if (err) reject(err)
          resolve(id)
        },
      ),
    )
    return res.status(202).send(messageId)
  } catch (error) {
    next(error)
  }
}
