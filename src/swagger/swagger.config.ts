import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { execSync } from 'child_process';
import { DocumentBuilder } from '@nestjs/swagger';
import { SwaggerTagDescriptions } from './swagger.tags';

export function setupSwagger(app: INestApplication) {
  const AUTHOR = execGit('git log -1 --pretty=format:"%an"');
  const LAST_DATE = execGit('git log -1 --pretty=format:"%ad"');
  const LAST_MSG = execGit('git log -1 --pretty=format:"%s"');

  // ambil semua file yang berubah terkait dokumentasi
  const DOC_CHANGES = execGit(`git diff --name-only HEAD~1 HEAD -- src/swagger`);

  // ambil perubahan decorator swagger di controller
  const API_DECORATOR_CHANGES = execGit(
    `git diff -U0 HEAD~1 HEAD -- '**/*.ts' | grep -E '@Api|@ApiProperty|@ApiTags' || true`
  );

  const config = new DocumentBuilder()
    .setTitle('DOKUMENTASI API EMKL')
    .setDescription(buildDescription(AUTHOR, LAST_DATE, LAST_MSG, DOC_CHANGES, API_DECORATOR_CHANGES))
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.tags = SwaggerTagDescriptions;

  SwaggerModule.setup('api-docs', app, document);
}

function execGit(cmd: string) {
  try {
    return execSync(cmd).toString().trim();
  } catch {
    return '';
  }
}

function buildDescription(
  author: string,
  date: string,
  lastMsg: string,
  docChanges: string,
  decoratorChanges: string,
) {
  return `
### 📌 Last Modified
- **Author:** ${author || 'Unknown'}
- **Date:** ${date || '-'}
- **Commit:** ${lastMsg || '-'}

---

### 📝 Recent API Documentation Changes (src/swagger)
${formatList(docChanges)}

---

### 🧩 Swagger Decorator Changes (Controller / DTO)
${decoratorChanges ? '```diff\n' + decoratorChanges + '\n```' : '_No decorator changes detected_'}
`;
}

function formatList(text: string) {
  if (!text) return '_No changes detected_';
  return text.split('\n').map(f => `- ${f}`).join('\n');
}
