/**
 * Process pull command
 */

import { apiGet } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pulls a process from the server
 */
export async function pullProcess(
  marketplace: string,
  processName: string,
  path: string,
  version?: string,
  alias?: string
): Promise<void> {
  try {
    const queryParams: Record<string, string> = {
      marketplace,
      name: processName,
    };

    if (version) {
      queryParams.version = version;
    } else if (alias) {
      queryParams.alias = alias;
    }

    const response = await apiGet<{ data: any }>(
      '/processes/show',
      queryParams
    );

    if (!response.data) {
      throw new Error(`Invalid API response: ${JSON.stringify(response)}`);
    }

    // API returns process/process, process/version, process/name, etc. with slashes as keys
    const processDefinition = response.data['process/process'] || response.data.definition;
    const processVersion = response.data['process/version'] || response.data.version;
    const emailTemplates = response.data['process/emailTemplates'] || [];

    if (!processDefinition) {
      throw new Error(`No process definition in API response: ${JSON.stringify(response)}`);
    }

    // Ensure directory exists
    mkdirSync(path, { recursive: true });

    // Write process.edn file
    const processFilePath = join(path, 'process.edn');
    writeFileSync(processFilePath, processDefinition, 'utf-8');

    // Write email templates if they exist
    const templates = emailTemplates || [];

    if (templates && Array.isArray(templates) && templates.length > 0) {
      const templatesDir = join(path, 'templates');
      mkdirSync(templatesDir, { recursive: true });

      for (const template of templates) {
        // Template name without prefix (e.g., "booking-new-request")
        const templateName = template['emailTemplate/name'];
        const htmlContent = template['emailTemplate/html'];
        const subjectContent = template['emailTemplate/subject'];

        if (templateName) {
          // Create subdirectory for this template
          const templateSubdir = join(templatesDir, templateName);
          mkdirSync(templateSubdir, { recursive: true });

          // Write HTML file
          if (htmlContent) {
            const htmlPath = join(templateSubdir, `${templateName}-html.html`);
            writeFileSync(htmlPath, htmlContent, 'utf-8');
          }

          // Write subject file
          if (subjectContent) {
            const subjectPath = join(templateSubdir, `${templateName}-subject.txt`);
            writeFileSync(subjectPath, subjectContent, 'utf-8');
          }
        }
      }
    }

    printSuccess(`Process ${processName} (version ${processVersion}) successfully pulled to ${path}.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to pull process');
    }
    process.exit(1);
  }
}
