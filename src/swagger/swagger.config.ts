import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { execSync } from 'child_process';
import { SwaggerTagDescriptions } from './swagger.tags';

export function setupSwagger(app: INestApplication) {
  // commit terakhir yang menyentuh swagger folder
  const SWAGGER_AUTHOR = git(`git log -1 --pretty=format:"%an" -- src/swagger`);
  const SWAGGER_DATE   = git(`git log -1 --pretty=format:"%ad" -- src/swagger`);
  const SWAGGER_MSG    = git(`git log -1 --pretty=format:"%s" -- src/swagger`);

  // file apa saja yang berubah
  const SWAGGER_FILE_CHANGES = git(
    `git diff --name-only HEAD~1 HEAD -- src/swagger`
  );

  // diff baris detailnya
  const SWAGGER_DIFF = git(
    `git diff HEAD~1 HEAD -- src/swagger`
  );

  // decorator API yang berubah seluruh project
  const DECORATOR_CHANGES = git(
    `git diff HEAD~1 HEAD -- '**/*.ts' | grep -E '@Api|@ApiProperty|@ApiTags|@ApiResponse' || true`
  );

  const config = new DocumentBuilder()
    .setTitle('DOKUMENTASI API EMKL')
    .setDescription(
      buildDescription(
        SWAGGER_AUTHOR,
        SWAGGER_DATE,
        SWAGGER_MSG,
        SWAGGER_FILE_CHANGES,
        SWAGGER_DIFF,
        DECORATOR_CHANGES
      )
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.tags = SwaggerTagDescriptions;

  SwaggerModule.setup('api-docs', app, document);
}

function git(cmd: string) {
  try {
    return execSync(cmd).toString().trim();
  } catch {
    return '';
  }
}

function buildDescription(
  author: string,
  date: string,
  commitMsg: string,
  fileChanges: string,
  fileDiff: string,
  decoratorChanges: string,
) {
  return `
### 🔧 Last Swagger Modification
- **Author:** ${author || '-'}
- **Date:** ${date || '-'}
- **Commit Message:** ${commitMsg || '-'}

---

### 📄 Changed Swagger Files
${formatList(fileChanges)}

---

### 📌 Line-by-Line Changes (src/swagger)
${fileDiff ? '```diff\n' + fileDiff + '\n```' : '_No line changes detected_'}

---

### 🧩 Swagger Decorator Changes (Controller / DTO)
${decoratorChanges ? '```diff\n' + decoratorChanges + '\n```' : '_No decorator changes detected_'}
`;
}

function formatList(txt: string) {
  if (!txt) return '_No changes detected_';
  return txt.split('\n').map(t => `- ${t}`).join('\n');
}
