/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

import fs from 'fs'
import * as mustache from 'mustache'
import RMSQWorker, { Client } from 'rsmq-worker'
import { PdfContent, AnalysisResults } from '../../types/generateDocument'
import { QUEUE_INTERVAL } from '../../util/secrets'
import {
  SfApi,
  InstalledSubscriberPackage,
  SubscriberPackage,
  SubscriberPackageVersion,
} from '../../util/sfApi'
import logger from '../../util/logger'
import { RedisClient } from 'redis'
import puppeteer from 'puppeteer'

import { LEGACY_VERSION, PACKAGE_NAME } from '../../util/secrets'

interface MessageObj {
  OrgInfo: {
    InstanceUrl: string
    IsSandbox: boolean
    Username: string
    OrgId: string
    AccessToken: string
    ApiVersion: string
  }
  AssessmentId: string
  AnalysisDocumentId: string
  Url: string
  Content: PdfContent
  RequestId: string
  Namespace: string
}

// Declare a global variable to hold the mode of the incoming data, defaulting to full
let mode = 'full'
let hideSummary = false

const REDIS_WORKER_QUEUE_NAME = 'pdfQueue'
const SF_ASSESSMENT_OBJECT = 'Assessment__c'
const SF_PDF_COMPLETE_FULL = 'PDF_Generation_Complete__c'
const SF_PDF_COMPLETE_SUMMARY = 'Report_Summary_PDF_Generation_Complete__c'
const SF_PDF_CONTENT_JSON_FILENAME = 'analysis.json'

// Define placeholders for the PDF filenames, to be set before the PDF file is saved and sent back
let SF_PDF_FILENAME_FULL = ''
let SF_PDF_FILENAME_SUMMARY = ''

class PdfQueue {
  client!: Client
  start(redis: RedisClient) {
    this.client = new RMSQWorker(REDIS_WORKER_QUEUE_NAME, {
      redis,
      autostart: true,
      timeout: 6 * 60 * 1000,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // NOTE: interval DOES except number | number[] but the @types definition have not been updated
      //  https://github.com/mpneuried/rsmq-worker/blob/master/README.md#options-interval
      interval: QUEUE_INTERVAL,
    })

    this.client.on('message', async function (msg, next, id) {
      try {
        const {
          OrgInfo: { Username, OrgId, InstanceUrl, IsSandbox, ApiVersion },
          AssessmentId,
          AnalysisDocumentId,
          Content,
          RequestId,
          Namespace,
        } = JSON.parse(msg) as MessageObj
        logger.debug(`[${REDIS_WORKER_QUEUE_NAME}:${id}] ${msg}`, RequestId)
        const bulkApiClient = await new SfApi(
          InstanceUrl,
          Username,
          OrgId,
          ApiVersion,
          IsSandbox,
          redis,
          RequestId,
          AssessmentId,
          Namespace,
        )

        bulkApiClient.createJsForceConnection()

        // get contentversionId from documentId: SELECT Id FROM ContentVersion WHERE ContentDocumentId = :fileDocId AND IsLatest = true
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetching latest ContentVersion Id from Document ${AnalysisDocumentId}`,
          RequestId,
        )
        const contentVersionId = (await bulkApiClient.getContentVersionIds(
          AnalysisDocumentId,
          true,
        )) as string

        // Download analysis file (ContentVersion.Body)
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetching ${SF_PDF_CONTENT_JSON_FILENAME}...`,
          RequestId,
        )
        const {
          sharingSettingResults,
          migrationAnalysis,
          assessmentResults,
          accessInfoResults,
          encryptionResults,
          fieldAuditResults,
          reportSummaryResults,
        }: AnalysisResults = JSON.parse(
          (
            await bulkApiClient.fetchRecord('ContentVersion', contentVersionId)
          ).toString(),
        )
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetched ${SF_PDF_CONTENT_JSON_FILENAME}`,
          RequestId,
        )

        const combinedPdfContent: PdfContent = {
          ...Content,
        }

        combinedPdfContent.assessmentResults.sharingSettingResults =
          sharingSettingResults
        combinedPdfContent.assessmentResults.migrationAnalysis =
          migrationAnalysis
        combinedPdfContent.assessmentResults.assessmentResults =
          assessmentResults
        combinedPdfContent.assessmentResults.accessInfoResults =
          accessInfoResults
        combinedPdfContent.assessmentResults.encryptionResults =
          encryptionResults
        combinedPdfContent.assessmentResults.fieldAuditResults =
          fieldAuditResults
        combinedPdfContent.assessmentResults.reportSummaryResults =
          reportSummaryResults

        // LM 4/7/22 - Adding a Tooling API query to determine whether to use this latest version or the legacy PDF generation
        let useLegacy = false
        if (LEGACY_VERSION != null && PACKAGE_NAME != null) {
          useLegacy = await queryApplicationVersion(bulkApiClient)
        }

        // Define a placeholder for the PDF buffer
        let pdfBuffer

        // Use the correct PDF buffer based on whether legacy PDF creation is in use
        if (useLegacy === true) {
          pdfBuffer = await legacyJsonToPdfBuffer(combinedPdfContent)
        } else {
          pdfBuffer = await jsonToPdfBuffer(combinedPdfContent)
        }

        logger.debug(
          `Created PDF buffer of ${pdfBuffer.byteLength} bytes`,
          RequestId,
        )

        // Save results file in Salesforce with the correct name based on the mode used
        let isResultFileSaved
        if (mode === 'full') {
          logger.debug(
            `[${REDIS_WORKER_QUEUE_NAME}:${id}] Create Salesforce file ${SF_PDF_FILENAME_FULL} related to Assessment`,
            RequestId,
          )

          isResultFileSaved = await bulkApiClient.insertFile(
            AssessmentId,
            SF_PDF_FILENAME_FULL,
            pdfBuffer,
          )
        } else if (mode === 'summary') {
          logger.debug(
            `[${REDIS_WORKER_QUEUE_NAME}:${id}] Create Salesforce file ${SF_PDF_FILENAME_SUMMARY} related to Assessment`,
            RequestId,
          )

          isResultFileSaved = await bulkApiClient.insertFile(
            AssessmentId,
            SF_PDF_FILENAME_SUMMARY,
            pdfBuffer,
          )
        }

        // Save the file based on the mode requested
        if (mode === 'full') {
          logger.debug(
            `[${REDIS_WORKER_QUEUE_NAME}:${id}] Create Salesforce file ${SF_PDF_FILENAME_FULL} related to Assessment`,
            RequestId,
          )

          if (isResultFileSaved) {
            // Set Assessment pdf complete checkbox
            await bulkApiClient.updateRecordData(
              `${Namespace}${SF_ASSESSMENT_OBJECT}`,
              AssessmentId,
              {
                [`${Namespace}${SF_PDF_COMPLETE_FULL}`]: true,
              },
            )
            logger.debug(
              `[${REDIS_WORKER_QUEUE_NAME}:${id}] Set ${Namespace}${SF_ASSESSMENT_OBJECT}.${Namespace}${SF_PDF_COMPLETE_FULL} to 'true'`,
              RequestId,
            )
          } else {
            logger.error(
              `[${REDIS_WORKER_QUEUE_NAME}:${id}] Failed to save ${SF_PDF_FILENAME_FULL}. PDF generation failed to complete with success.`,
              RequestId,
            )
          }
        } else if (mode === 'summary') {
          if (isResultFileSaved) {
            // Set Report Summary pdf complete checkbox
            await bulkApiClient.updateRecordData(
              `${Namespace}${SF_ASSESSMENT_OBJECT}`,
              AssessmentId,
              {
                [`${Namespace}${SF_PDF_COMPLETE_SUMMARY}`]: true,
              },
            )
            logger.debug(
              `[${REDIS_WORKER_QUEUE_NAME}:${id}] Set ${Namespace}${SF_ASSESSMENT_OBJECT}.${Namespace}${SF_PDF_COMPLETE_SUMMARY} to 'true'`,
              RequestId,
            )
          } else {
            logger.error(
              `[${REDIS_WORKER_QUEUE_NAME}:${id}] Failed to save ${SF_PDF_FILENAME_SUMMARY}. PDF generation failed to complete with success.`,
              RequestId,
            )
          }
        }

        //ACK MQ
        next()
      } catch (error: any) {
        logger.error(error.stack)
        //ACK MQ
        next()
      }
    })

    // optional error listeners
    this.client.on('error', function (err, msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}]${err}`)
    })
    this.client.on('exceeded', function (msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}] EXCEEDED`)
    })
    this.client.on('timeout', function (msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}] TIMEOUT ${msg.rc}`)
    })
  }
}

const jsonToPdfBuffer = async (PdfContent: PdfContent): Promise<Buffer> => {
  // Determine the type of transition being run to implement the correct templates
  const [type, ...rest] = PdfContent.assessmentResults.upgradeType.split(' ')
  PdfContent.type = type

  // launch a new chrome instance
  const browser = await puppeteer.launch({
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox'],
  })

  // Set the global indicator of the PDF mode
  mode = PdfContent.mode
  hideSummary = PdfContent.hideSummary

  console.log('Value if PdfContent')
  console.log(PdfContent)

  console.log('Value of reportSummaryResults')
  console.log(PdfContent.assessmentResults.reportSummaryResults)

  console.log('Value of LOBs')
  console.log(
    PdfContent.assessmentResults.reportSummaryResults?.linesOfBusiness,
  )

  try {
    // create a new page
    const page = await browser.newPage()

    // Generate the html for the PDF
    const html = preparePdfContent(PdfContent)

    // Use the result of the template html to execute mustache template data replacement
    const output = mustache.render(html, PdfContent)

    await page.setContent(output, {
      waitUntil: 'domcontentloaded',
    })

    // Get the correct header and footer template partials depending on the current cloud
    let header = ''
    let footer = ''

    if (PdfContent.type === 'FSC') {
      header = readPartial('page_header', 'partials/fsc')
      footer = readPartial('page_footer', 'partials/fsc')
      SF_PDF_FILENAME_FULL =
        'Financial Services Cloud Transition Assistant Report.pdf'
      SF_PDF_FILENAME_SUMMARY =
        'Financial Services Cloud Transition Assistant Report Summary.pdf'
    } else if (PdfContent.type === 'HC') {
      header = readPartial('page_header', 'partials/hc')
      footer = readPartial('page_footer', 'partials/hc')
      SF_PDF_FILENAME_FULL = 'Health Cloud Transition Assistant Report.pdf'
      SF_PDF_FILENAME_SUMMARY =
        'Health Cloud Transition Assistant Report Summary.pdf'
    } else if (PdfContent.type === 'AC') {
      header = readPartial('page_header', 'partials/ac')
      footer = readPartial('page_footer', 'partials/ac')
      SF_PDF_FILENAME_FULL = 'Automotive Cloud Transition Assistant Report.pdf'
      SF_PDF_FILENAME_SUMMARY =
        'Automotive Cloud Transition Assistant Report Summary.pdf'
    }

    // create a pdf buffer
    const pdfBuffer = await page.pdf({
      format: 'a4',
      displayHeaderFooter: true,
      footerTemplate: footer,
      headerTemplate: header,
      margin: {
        top: '200px',
        bottom: '200px',
      },
    })
    await browser.close()

    //const writeFile = fs.writeFileSync(`/app/${SF_PDF_CONTENT_JSON_FILENAME}`, pdfBuffer)

    return pdfBuffer
  } catch (error: any) {
    logger.error(error.stack)
    await browser.close()
    throw Error(`Error generating PDF: ${error.message}`)
  }
}

const readPartial = (partial_name: string, path: string): string => {
  return fs.readFileSync(
    `/app/templates/${path}/${partial_name}.mustache`,
    'utf8',
  )
}

function preparePdfContent(PdfContent: PdfContent) {
  // Create a placeholder for the html
  let html = ''

  // Determine the generation path to follow
  if (PdfContent.mode === 'full') {
    if (PdfContent.type === 'FSC') {
      const templatePath =
        '/app/templates/partials/fsc/assessment_report.mustache'
      html = fs.readFileSync(templatePath, 'utf8')

      // Process the common report html content.
      html = commonContent(PdfContent, html)

      // Process all HC-specific full report html content
      html = cloudContent(PdfContent, html, 'fsc')
    } else if (PdfContent.type === 'HC') {
      const templatePath =
        '/app/templates/partials/hc/assessment_report.mustache'
      html = fs.readFileSync(templatePath, 'utf8')

      // Process the common report html content
      html = commonContent(PdfContent, html)

      // Process all HC-specific full report html content
      html = cloudContent(PdfContent, html, 'hc')
    } else if (PdfContent.type === 'AC') {
      const templatePath =
        '/app/templates/partials/ac/assessment_report.mustache'
      html = fs.readFileSync(templatePath, 'utf8')

      // Process the common report html content
      html = commonContent(PdfContent, html)

      // Process all AC-specific full report html content
      html = cloudContent(PdfContent, html, 'ac')
    }
  } else if (PdfContent.mode === 'summary') {
    if (PdfContent.type === 'FSC') {
      const templatePath =
        '/app/templates/partials/common/report_summary/report_summary.mustache'
      html = fs.readFileSync(templatePath, 'utf8')

      // Process the common report html content
      html = commonContent(PdfContent, html)

      // Process all HC-specific full report html content
      html = cloudContent(PdfContent, html, 'fsc')
    } else if (PdfContent.type === 'HC') {
      const templatePath =
        '/app/templates/partials/common/report_summary/report_summary.mustache'
      html = fs.readFileSync(templatePath, 'utf8')

      // Process the common report html content
      html = commonContent(PdfContent, html)

      // Process all HC-specific full report html content
      html = cloudContent(PdfContent, html, 'hc')
    } else if (PdfContent.type === 'AC') {
      const templatePath =
        '/app/templates/partials/common/report_summary/report_summary.mustache'
      html = fs.readFileSync(templatePath, 'utf8')

      // Process the common report html content
      html = commonContent(PdfContent, html)

      // Process all AC-specific full report html content
      html = cloudContent(PdfContent, html, 'ac')
    }
  }

  return html
}

function commonContent(PdfContent: PdfContent, html: string) {
  console.log('Value of PdfContent')
  console.log(PdfContent.assessmentResults.preSalesItems)

  // Define path to common partials
  const partialsBasePath = 'partials/common'

  // Assemble the definitions of all common template partials
  const html_head = readPartial('header', partialsBasePath)

  // Primary report template definitions
  const stylesheet = readPartial('stylesheet', partialsBasePath)
  const subsection = readPartial('subsection', partialsBasePath)
  const assessmentHeader = readPartial('assessment_header', partialsBasePath)
  const profilePermissions = readPartial(
    'profile_permissions',
    partialsBasePath,
  )
  const sharingSettings = readPartial('sharing_settings', partialsBasePath)
  const fieldAnalysis = readPartial('field_analysis', partialsBasePath)
  const transitionApproach = readPartial(
    'transition_approach',
    partialsBasePath,
  )

  // Full report report summary section template definitions
  const reportSummary_section = readPartial(
    'report_summary_section',
    partialsBasePath,
  )
  const reportSummary_subsection = readPartial(
    'subsection',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_understandingThisReport = readPartial(
    'understanding_this_report',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_systemOverview = readPartial(
    'system_overview',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_notableUsedObjects = readPartial(
    'notable_used_objects',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_recommendedTransitionApproach = readPartial(
    'recommended_transition_approach',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_recommendedSettings = readPartial(
    'recommended_settings',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_basisOfAssessment = readPartial(
    'basis_of_assessment',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_majorConsiderations = readPartial(
    'major_considerations',
    partialsBasePath + '/report_summary',
  )
  const reportSummary_migrationAnalysis = readPartial(
    'migration_analysis_summary',
    partialsBasePath + '/report_summary',
  )

  // Definition of common svg file paths
  const standard_solution_icon = readPartial(
    'standard_solution',
    partialsBasePath + '/svg',
  )
  const action_approval_icon = readPartial(
    'action_approval',
    partialsBasePath + '/svg',
  )
  const action_close_icon = readPartial(
    'action_close',
    partialsBasePath + '/svg',
  )
  const utility_error_icon = readPartial(
    'utility_error',
    partialsBasePath + '/svg',
  )
  const utility_info_icon = readPartial(
    'utility_info',
    partialsBasePath + '/svg',
  )
  const chevron_right = readPartial('chevron_right', partialsBasePath + '/svg')

  // General report section replacement
  html = html.replace('__SUBSECTION__', subsection)
  html = html.replace('__ASSESSMENT_HEADER__', assessmentHeader)
  html = html.replace('__TRANSITION_APPROACH__', transitionApproach)
  html = html.replace('__PROFILE_ANALYSIS__', profilePermissions)
  html = html.replace('__SHARING_SETTING_ANALYSIS__', sharingSettings)
  html = html.replace('__FIELD_ANALYSIS__', fieldAnalysis)

  // Report summary section replacement
  html = html.replace('__REPORT_SUMMARY_SECTION__', reportSummary_section)
  html = html.replace(
    '__UNDERSTANDING_THIS_REPORT__',
    reportSummary_understandingThisReport,
  )
  html = html.replace('__SYSTEM_OVERVIEW__', reportSummary_systemOverview)
  html = html.replace(
    '__NOTABLE_USED_OBJECTS__',
    reportSummary_notableUsedObjects,
  )
  html = html.replace(
    '__RECOMMENDED_TRANSITION_APPROACH__',
    reportSummary_recommendedTransitionApproach,
  )
  html = html.replace(
    '__RECOMMENDED_SETTINGS__',
    reportSummary_recommendedSettings,
  )
  html = html.replace(
    '__BASIS_OF_ASSESSMENT__',
    reportSummary_basisOfAssessment,
  )
  html = html.replace(
    '__MAJOR_CONSIDERATIONS__',
    reportSummary_majorConsiderations,
  )
  html = html.replace(
    '__MIGRATION_ANALYSIS_SUMMARY__',
    reportSummary_migrationAnalysis,
  )
  html = html.replace('__REPORT_SUMMARY_SUBSECTION__', reportSummary_subsection)

  // Handling of header and chevron template piece replacement
  html = html.replace('__HTML_HEAD__', html_head)
  html = html.replace('__STYLESHEET__', stylesheet)
  html = html.replace(/__CHEVRON_RIGHT__/g, chevron_right)
  html = html.replace('__CHEVRON_RIGHT__', chevron_right)

  // Run replacement for Overall Recommendation icons to the appropriate SVGs
  if (
    PdfContent.assessmentResults &&
    PdfContent.assessmentResults.overallRecommendation
  ) {
    PdfContent.assessmentResults.overallRecommendation.severityIcon =
      PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
        'standard:solution',
        standard_solution_icon,
      )
    PdfContent.assessmentResults.overallRecommendation.severityIcon =
      PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
        'action:approval',
        action_approval_icon,
      )
    PdfContent.assessmentResults.overallRecommendation.severityIcon =
      PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
        'action:close',
        action_close_icon,
      )
    // Loop through all of the recommendations for this item, seeking labels to replace
    PdfContent.assessmentResults.overallRecommendation.reasons.forEach(
      (item) => {
        if (item.reason === PdfContent.label.recHasNoLex) {
          item.reason = PdfContent.label.recHasNoLexPdf
        }
        if (item.reason === PdfContent.label.recHasNoPersonAccounts) {
          item.reason = PdfContent.label.recHasNoPersonAccountsPdf
        }
        if (item.reason === PdfContent.label.recHasNoContactMultipleAccounts) {
          item.reason = PdfContent.label.recHasNoContactMultipleAccountsPdf
        }
      },
    )
  }

  // Run replacement for Recommendation icons to the appropriate SVGs
  if (
    PdfContent.assessmentResults &&
    PdfContent.assessmentResults.recommendations
  ) {
    PdfContent.assessmentResults.recommendations.forEach((item) => {
      item.severityIcon = item.severityIcon.replace(
        'standard:solution',
        standard_solution_icon,
      )
      item.severityIcon = item.severityIcon.replace(
        'action:approval',
        action_approval_icon,
      )
      item.severityIcon = item.severityIcon.replace(
        'action:close',
        action_close_icon,
      )
      // Loop through all of the recommendations for this item, seeking labels to replace
      item.reasons.forEach((item) => {
        console.log(item.reason)
        if (item.reason === PdfContent.label.recHasNoLex) {
          item.reason = PdfContent.label.recHasNoLexPdf
        }
        if (item.reason === PdfContent.label.recHasNoPersonAccounts) {
          item.reason = PdfContent.label.recHasNoPersonAccountsPdf
        }
        if (item.reason === PdfContent.label.recHasNoContactMultipleAccounts) {
          item.reason = PdfContent.label.recHasNoContactMultipleAccountsPdf
        }
      })
    })
  }

  return html
}

function cloudContent(PdfContent: PdfContent, html: string, cloud: string) {
  const partialsBasePath = 'partials/' + cloud

  const welcome = readPartial('welcome', partialsBasePath)
  const assessmentResults = readPartial('assessment_results', partialsBasePath)
  const migrationAnalysis = readPartial('migration_analysis', partialsBasePath)

  // Definition of svg file paths
  const utility_warning_icon = readPartial(
    'utility_warning',
    partialsBasePath + '/svg',
  )
  const standard_solution_icon = readPartial(
    'standard_solution',
    'partials/common/svg',
  )
  const action_approval_icon = readPartial(
    'action_approval',
    'partials/common/svg',
  )
  const action_close_icon = readPartial('action_close', 'partials/common/svg')
  const utility_error_icon = readPartial('utility_error', 'partials/common/svg')
  const utility_info_icon = readPartial('utility_info', 'partials/common/svg')

  // Run html content replacement on cloud-specific template contents
  html = html.replace('__WELCOME__', welcome)
  html = html.replace('__ASSESSMENT_RESULTS__', assessmentResults)
  html = html.replace('__MIGRATION_ANALYSIS__', migrationAnalysis)

  // Svg template piece replacement
  html = html.replace('__UTILITY_WARNING__', utility_warning_icon)
  html = html.replace('__ACTION_APPROVAL__', action_approval_icon)
  html = html.replace('__STANDARD_SOLUTION__', standard_solution_icon)
  html = html.replace('__ACTION_CLOSE__', action_close_icon)
  html = html.replace('__UTILITY_INFO__', utility_info_icon)
  html = html.replace('__UTILITY_ERROR__', utility_error_icon)

  // Run replacement for cloud-specific Overall Recommendation icons to the appropriate SVGs
  if (
    PdfContent.assessmentResults &&
    PdfContent.assessmentResults.overallRecommendation
  ) {
    PdfContent.assessmentResults.overallRecommendation.severityIcon =
      PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
        'utility:warning',
        utility_warning_icon,
      )
    PdfContent.assessmentResults.overallRecommendation.severityIcon =
      PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
        'utility:info',
        utility_info_icon,
      )
  }

  // Run replacement for cloud-specific Recommendation icons to the appropriate SVGs
  if (
    PdfContent.assessmentResults &&
    PdfContent.assessmentResults.recommendations
  ) {
    PdfContent.assessmentResults.recommendations.forEach((item) => {
      item.severityIcon = item.severityIcon.replace(
        'utility:warning',
        utility_warning_icon,
      )
      item.severityIcon = item.severityIcon.replace(
        'utility:info',
        utility_info_icon,
      )
    })
  }

  // Run replacement for cloud-specific pre-sales items icons to the appropriate SVGs
  if (
    PdfContent.assessmentResults &&
    PdfContent.assessmentResults.preSalesItems
  ) {
    PdfContent.assessmentResults.preSalesItems.forEach((item) => {
      item.iconOverride = item.iconOverride.replace(
        'utility:warning',
        utility_warning_icon,
      )
      item.iconOverride = item.iconOverride.replace(
        'utility:info',
        utility_info_icon,
      )
    })
  }

  return html
}

export default new PdfQueue()

// LM 4/11/22 - The code below is meant for backwards compatibility for production version 238.0
// Once this specific backwards compatility is no longer needed, it can be removed
async function queryApplicationVersion(apiClient: SfApi): Promise<boolean> {
  // Create a baseline boolean of false, defaulting to false
  let runLegacy = false

  // Create a placeholder for the currentVersion below
  let currentVersion = ''

  // Fire the query to Salesforce synchronously
  const result = await apiClient.getToolingQuery(
    'SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage',
  )

  // Cast the retrieved data to the correct type
  const resultsData: InstalledSubscriberPackage[] = JSON.parse(
    JSON.stringify(result.records),
  )

  // Loop through the retrieved data and find if the correct package exists
  for (let i = 0; i < resultsData.length; i++) {
    if (resultsData[i].SubscriberPackage.Name === PACKAGE_NAME) {
      currentVersion =
        resultsData[i].SubscriberPackageVersion.MajorVersion +
        '.' +
        resultsData[i].SubscriberPackageVersion.MinorVersion +
        '.' +
        resultsData[i].SubscriberPackageVersion.PatchVersion +
        '.' +
        resultsData[i].SubscriberPackageVersion.BuildNumber
      break
    }
  }

  // Compare current version against legacy, returning true if we need to run legacy operations
  if (currentVersion != '') {
    const versionComparison = currentVersion.localeCompare(
      LEGACY_VERSION,
      undefined,
      { numeric: true, sensitivity: 'base' },
    )
    if (versionComparison <= 0) {
      console.log('Older version, using legacy PDF generation')
      runLegacy = true
    }
  }

  return runLegacy
}

const legacyJsonToPdfBuffer = async (
  PdfContent: PdfContent,
): Promise<Buffer> => {
  // launch a new chrome instance
  const browser = await puppeteer.launch({
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox'],
  })

  try {
    // create a new page
    const page = await browser.newPage()
    const templatePath =
      '/app/templates/partials/legacy/assessment_report.mustache'

    // set your html as the pages content
    let html = fs.readFileSync(templatePath, 'utf8')

    const html_head = readPartial('header', 'partials/legacy')
    const stylesheet = readPartial('stylesheet', 'partials/legacy')
    const header = readPartial('page_header', 'partials/legacy')
    const footer = readPartial('page_footer', 'partials/legacy')
    const subsection = readPartial('subsection', 'partials/legacy')
    const assessmentHeader = readPartial('assessment_header', 'partials/legacy')
    const assessmentResults = readPartial(
      'assessment_results',
      'partials/legacy',
    )
    const migrationAnalysis = readPartial(
      'migration_analysis',
      'partials/legacy',
    )
    const profilePermissions = readPartial(
      'profile_permissions',
      'partials/legacy',
    )
    const sharingSettings = readPartial('sharing_settings', 'partials/legacy')
    const fieldAnalysis = readPartial('field_analysis', 'partials/legacy')
    const transitionApproach = readPartial(
      'transition_approach',
      'partials/legacy',
    )

    // Report summary template piece definitions
    const reportSummary_section = readPartial(
      'report_summary_section',
      'partials/legacy',
    )
    const reportSummary_subsection = readPartial(
      'subsection',
      'partials/legacy/report_summary',
    )
    const reportSummary_understandingThisReport = readPartial(
      'understanding_this_report',
      'partials/legacy/report_summary',
    )
    const reportSummary_systemOverview = readPartial(
      'system_overview',
      'partials/legacy/report_summary',
    )
    const reportSummary_notableUsedObjects = readPartial(
      'notable_used_objects',
      'partials/legacy/report_summary',
    )
    const reportSummary_recommendedTransitionApproach = readPartial(
      'recommended_transition_approach',
      'partials/legacy/report_summary',
    )
    const reportSummary_recommendedSettings = readPartial(
      'recommended_settings',
      'partials/legacy/report_summary',
    )
    const reportSummary_basisOfAssessment = readPartial(
      'basis_of_assessment',
      'partials/legacy/report_summary',
    )
    const reportSummary_majorConsiderations = readPartial(
      'major_considerations',
      'partials/legacy/report_summary',
    )
    const reportSummary_migrationAnalysis = readPartial(
      'migration_analysis_summary',
      'partials/legacy/report_summary',
    )

    // Definition of svg file paths
    const standard_solution_icon = readPartial(
      'standard_solution',
      'partials/legacy/svg',
    )
    const utility_info_icon = readPartial('utility_info', 'partials/legacy/svg')
    const action_approval_icon = readPartial(
      'action_approval',
      'partials/legacy/svg',
    )
    const utility_warning_icon = readPartial(
      'utility_warning',
      'partials/legacy/svg',
    )
    const action_bug_icon = readPartial('action_bug', 'partials/legacy/svg')
    const action_close_icon = readPartial('action_close', 'partials/legacy/svg')
    const chevron_right = readPartial('chevron_right', 'partials/legacy/svg')

    html = html.replace('__SUBSECTION__', subsection)
    html = html.replace('__ASSESSMENT_HEADER__', assessmentHeader)
    html = html.replace('__TRANSITION_APPROACH__', transitionApproach)
    html = html.replace('__MIGRATION_ANALYSIS__', migrationAnalysis)
    html = html.replace('__ASSESSMENT_RESULTS__', assessmentResults)
    html = html.replace('__PROFILE_ANALYSIS__', profilePermissions)
    html = html.replace('__SHARING_SETTING_ANALYSIS__', sharingSettings)
    html = html.replace('__FIELD_ANALYSIS__', fieldAnalysis)

    // Report summary section replacement
    html = html.replace('__REPORT_SUMMARY_SECTION__', reportSummary_section)
    html = html.replace(
      '__UNDERSTANDING_THIS_REPORT__',
      reportSummary_understandingThisReport,
    )
    //html = html.replace('__TABLE_OF_CONTENTS__', reportSummary_tableOfContents)
    html = html.replace('__SYSTEM_OVERVIEW__', reportSummary_systemOverview)
    html = html.replace(
      '__NOTABLE_USED_OBJECTS__',
      reportSummary_notableUsedObjects,
    )
    html = html.replace(
      '__RECOMMENDED_TRANSITION_APPROACH__',
      reportSummary_recommendedTransitionApproach,
    )
    html = html.replace(
      '__RECOMMENDED_SETTINGS__',
      reportSummary_recommendedSettings,
    )
    html = html.replace(
      '__BASIS_OF_ASSESSMENT__',
      reportSummary_basisOfAssessment,
    )
    html = html.replace(
      '__MAJOR_CONSIDERATIONS__',
      reportSummary_majorConsiderations,
    )
    html = html.replace(
      '__MIGRATION_ANALYSIS_SUMMARY__',
      reportSummary_migrationAnalysis,
    )
    html = html.replace(
      '__REPORT_SUMMARY_SUBSECTION__',
      reportSummary_subsection,
    )

    html = html.replace('__ACTION_APPROVAL__', action_approval_icon)
    html = html.replace('__STANDARD_SOLUTION__', standard_solution_icon)
    html = html.replace('__UTILITY_WARNING__', utility_warning_icon)
    html = html.replace('__UTILITY_INFO__', utility_info_icon)
    html = html.replace('__ACTION_CLOSE__', action_close_icon)

    html = html.replace('__HTML_HEAD__', html_head)
    html = html.replace('__STYLESHEET__', stylesheet)
    html = html.replace(/__CHEVRON_RIGHT__/g, chevron_right)
    html = html.replace('__CHEVRON_RIGHT__', chevron_right)

    if (
      PdfContent.assessmentResults &&
      PdfContent.assessmentResults.overallRecommendation
    ) {
      PdfContent.assessmentResults.overallRecommendation.severityIcon =
        PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
          'standard:solution',
          standard_solution_icon,
        )
      PdfContent.assessmentResults.overallRecommendation.severityIcon =
        PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
          'action:approval',
          action_approval_icon,
        )
      PdfContent.assessmentResults.overallRecommendation.severityIcon =
        PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
          'utility:warning',
          utility_warning_icon,
        )
      PdfContent.assessmentResults.overallRecommendation.severityIcon =
        PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
          'utility:info',
          utility_info_icon,
        )
      PdfContent.assessmentResults.overallRecommendation.severityIcon =
        PdfContent.assessmentResults.overallRecommendation.severityIcon.replace(
          'action:bug',
          action_bug_icon,
        )
      // Loop through all of the recommendations for this item, seeking labels to replace
      PdfContent.assessmentResults.overallRecommendation.reasons.forEach(
        (item) => {
          if (item.reason === PdfContent.label.recHasNoLex) {
            item.reason = PdfContent.label.recHasNoLexPdf
          }
          if (item.reason === PdfContent.label.recHasNoPersonAccounts) {
            item.reason = PdfContent.label.recHasNoPersonAccountsPdf
          }
          if (
            item.reason === PdfContent.label.recHasNoContactMultipleAccounts
          ) {
            item.reason = PdfContent.label.recHasNoContactMultipleAccountsPdf
          }
        },
      )
    }

    if (
      PdfContent.assessmentResults &&
      PdfContent.assessmentResults.recommendations
    ) {
      PdfContent.assessmentResults.recommendations.forEach((item) => {
        item.severityIcon = item.severityIcon.replace(
          'standard:solution',
          standard_solution_icon,
        )
        item.severityIcon = item.severityIcon.replace(
          'action:approval',
          action_approval_icon,
        )
        item.severityIcon = item.severityIcon.replace(
          'utility:warning',
          utility_warning_icon,
        )
        item.severityIcon = item.severityIcon.replace(
          'utility:info',
          utility_info_icon,
        )
        item.severityIcon = item.severityIcon.replace(
          'action:bug',
          action_bug_icon,
        )
        // Loop through all of the recommendations for this item, seeking labels to replace
        item.reasons.forEach((item) => {
          if (item.reason === PdfContent.label.recHasNoLex) {
            item.reason = PdfContent.label.recHasNoLexPdf
          }
          if (item.reason === PdfContent.label.recHasNoPersonAccounts) {
            item.reason = PdfContent.label.recHasNoPersonAccountsPdf
          }
          if (
            item.reason === PdfContent.label.recHasNoContactMultipleAccounts
          ) {
            item.reason = PdfContent.label.recHasNoContactMultipleAccountsPdf
          }
        })
      })
    }

    // Run replacement for cloud-specific pre-sales items icons to the appropriate SVGs
    if (
      PdfContent.assessmentResults &&
      PdfContent.assessmentResults.preSalesItems
    ) {
      PdfContent.assessmentResults.preSalesItems.forEach((item) => {
        item.iconOverride = item.iconOverride.replace(
          'utility:warning',
          utility_warning_icon,
        )
        item.iconOverride = item.iconOverride.replace(
          'utility:info',
          utility_info_icon,
        )
      })
    }

    // Loop through the recommendations to add them to the Report Summary, truncating any with lists longer than 5 items
    if (
      PdfContent.assessmentResults &&
      PdfContent.assessmentResults.reportSummaryResults
    ) {
      PdfContent.assessmentResults.reportSummaryResults.recommendations =
        PdfContent.assessmentResults.recommendations
      for (const recommendation of PdfContent.assessmentResults
        .recommendations) {
        if (recommendation.reasons.length > 5) {
          recommendation.reasons = recommendation.reasons.slice(0, 4)

          const message =
            PdfContent.label.recommendationTextPrefix +
            recommendation.reasons.length +
            PdfContent.label.recommendationTextSuffix

          recommendation.reasons.push(message)
        }
      }
    }

    const output = mustache.render(html, PdfContent)

    SF_PDF_FILENAME_FULL = 'AssessmentReport.pdf'
    SF_PDF_FILENAME_SUMMARY = 'ReportSummary.pdf'

    await page.setContent(output, {
      waitUntil: 'domcontentloaded',
    })

    // create a pdf buffer
    const pdfBuffer = await page.pdf({
      format: 'a4',
      displayHeaderFooter: true,
      footerTemplate:
        '<div style="font-size: 10px !important;">' + footer + '</div>',
      headerTemplate:
        '<div style="font-size: 10px !important;">' + header + '</div>',
      margin: {
        top: '200px',
        bottom: '200px',
      },
    })
    await browser.close()

    //const writeFile = fs.writeFileSync(`/app/${SF_PDF_CONTENT_JSON_FILENAME}`, pdfBuffer)

    return pdfBuffer
  } catch (error: any) {
    logger.error(error.stack)
    await browser.close()
    throw Error(`Error generating PDF: ${error.message}`)
  }
}
