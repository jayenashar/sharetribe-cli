/**
 * Process push command
 */

import { apiPostMultipart, type MultipartField } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads email templates from the templates directory
 */
function readTemplates(path: string): Array<{ name: string; html: string; subject: string }> {
  const templatesDir = join(path, 'templates');
  const templates: Array<{ name: string; html: string; subject: string }> = [];

  try {
    const templateDirs = readdirSync(templatesDir);
    for (const templateName of templateDirs) {
      const templatePath = join(templatesDir, templateName);
      const htmlFile = join(templatePath, `${templateName}-html.html`);
      const subjectFile = join(templatePath, `${templateName}-subject.txt`);

      try {
        const html = readFileSync(htmlFile, 'utf-8');
        const subject = readFileSync(subjectFile, 'utf-8');
        templates.push({ name: templateName, html, subject });
      } catch {
        // Skip if files don't exist
      }
    }
  } catch {
    // No templates directory - return empty array
  }

  return templates;
}

/**
 * Pushes a new version of an existing process
 */
export async function pushProcess(
  marketplace: string,
  processName: string,
  path: string
): Promise<void> {
  try {
    const processFilePath = join(path, 'process.edn');
    const processContent = readFileSync(processFilePath, 'utf-8');
    const templates = readTemplates(path);

    // Build multipart fields
    const fields: MultipartField[] = [
      { name: 'name', value: processName },
      { name: 'definition', value: processContent },
    ];

    // Add template fields
    for (const template of templates) {
      fields.push({ name: `template-html-${template.name}`, value: template.html });
      fields.push({ name: `template-subject-${template.name}`, value: template.subject });
    }

    const response = await apiPostMultipart<{ data: any; meta?: { result?: string } }>(
      '/processes/create-version',
      { marketplace },
      fields
    );

    if (response.meta?.result === 'no-changes') {
      console.log('No changes');
    } else {
      const version = response.data['process/version'] || response.data.version;
      printSuccess(`Version ${version} successfully saved for process ${processName}.`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to push process');
    }
    process.exit(1);
  }
}
