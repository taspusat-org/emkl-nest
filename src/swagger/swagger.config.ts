import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { execSync } from 'child_process';
import { SwaggerTagDescriptions } from './swagger.tags';
import { readFileSync } from 'fs';
import { join } from 'path';

export function setupSwagger(app: INestApplication) {
  // 1️⃣ Commit terakhir yang menyentuh file swagger
  const LAST_SWAGGER_COMMIT = git(
    `git log -1 --pretty=format:"%H" -- src/swagger/swagger.config.ts src/swagger/swagger.tags.ts`
  );

  const SWAGGER_FILE_CHANGES = git(
    `git diff --name-only ${LAST_SWAGGER_COMMIT}~1 ${LAST_SWAGGER_COMMIT} -- src/swagger/swagger.config.ts src/swagger/swagger.tags.ts`
  );

  const SWAGGER_RAW_DIFF = git(
    `git diff ${LAST_SWAGGER_COMMIT}~1 ${LAST_SWAGGER_COMMIT} -- src/swagger/swagger.config.ts src/swagger/swagger.tags.ts`
  );
  const SWAGGER_CLEAN_DIFF = cleanDiff(SWAGGER_RAW_DIFF);

  // Info commit file swagger
  const SWAGGER_AUTHOR = git(`git show -s --pretty=format:"%an" ${LAST_SWAGGER_COMMIT}`);
  const SWAGGER_DATE   = git(`git show -s --pretty=format:"%ad" ${LAST_SWAGGER_COMMIT}`);
  const SWAGGER_MSG    = git(`git show -s --pretty=format:"%s" ${LAST_SWAGGER_COMMIT}`);

  // 2️⃣ Commit terakhir di seluruh repo (untuk decorator)
  const LAST_DECORATOR_COMMIT = git(`git log -1 --pretty=format:"%H"`);

  const DECORATOR_RAW = git(
    `git diff ${LAST_DECORATOR_COMMIT}~1 ${LAST_DECORATOR_COMMIT} -- '**/*.ts' | grep -E '^\\+|^\\-' | grep -E '@Api|@ApiProperty|@ApiTags|@ApiResponse|@ApiOperation|@ApiExtraModels|@ApiBearerAuth' || true`
  );
  const DECORATOR_DIFF = cleanDiff(DECORATOR_RAW);

  // 3️⃣ Ambil full description untuk tag yang berubah di swagger.tags.ts
  const SWAGGER_TAGS_PATH = join(process.cwd(), 'src', 'swagger', 'swagger.tags.ts');
  const SWAGGER_TAGS_CONTENT = readFileSync(SWAGGER_TAGS_PATH, 'utf-8');

  const SWAGGER_TAGS_RAW_DIFF = git(
    `git diff ${LAST_SWAGGER_COMMIT}~1 ${LAST_SWAGGER_COMMIT} -- src/swagger/swagger.tags.ts`
  );

  const SWAGGER_TAGS_FULL_DESCRIPTION = getChangedTagDescriptions(SWAGGER_TAGS_RAW_DIFF, SWAGGER_TAGS_CONTENT);

  // Build swagger document
  const config = new DocumentBuilder()
    .setTitle('DOKUMENTASI API EMKL')
    .setDescription(
      buildDescription(
        SWAGGER_AUTHOR,
        SWAGGER_DATE,
        SWAGGER_MSG,
        SWAGGER_FILE_CHANGES,
        SWAGGER_CLEAN_DIFF,
        DECORATOR_DIFF,
        SWAGGER_TAGS_FULL_DESCRIPTION
      )
    )
    .setVersion('1.0')
    .addServer('http://localhost:3003/', 'Local environment')
    .addServer('https://emkl.transporindo.com/', 'Production')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.tags = SwaggerTagDescriptions;

  SwaggerModule.setup('api-docs', app, document);
}

function git(cmd: string) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

// Bersihin diff → hanya + dan -
function cleanDiff(diff: string) {
  if (!diff) return '';
  return diff
    .split('\n')
    .filter(line => line.startsWith('+') || line.startsWith('-'))
    .filter(line => !line.startsWith('+++') && !line.startsWith('---'))
    .join('\n');
}

// Ambil full description tag yang berubah
function getChangedTagDescriptions(diff: string, fileContent: string) {
  if (!diff) return '';

  // Ambil array dari file
  const arrayString = fileContent.replace('export const SwaggerTagDescriptions =', '');
  const moduleExports = eval(arrayString); // aman karena controlled file

  const changedTags = moduleExports.filter((tag: any) => {
    // Kalau diff mengandung kata di description atau nama tag
    return diff.includes(tag.name) || diff.includes(tag.description.slice(0, 20));
  });

  return changedTags.map((tag: any) => `${tag.name}:\n${tag.description}`).join('\n\n');
}

// Format tampilan swagger
function buildDescription(
  author: string,
  date: string,
  msg: string,
  swaggerFileChanges: string,
  swaggerLineDiff: string,
  decoratorDiff: string,
  swaggerTagsFullDescription: string
) {
  return `
### 🔧 Last Swagger Modification (File swagger.config.ts & swagger.tags.ts)
- **Author:** ${author || '-'}
- **Date:** ${date || '-'}
- **Commit:** ${msg || '-'}

---

<details>
<summary><strong>📄 Changed Swagger Files</strong></summary>

${formatList(swaggerFileChanges)}

</details>

---

<details>
<summary><strong>📌 Line Changes (swagger.config.ts & swagger.tags.ts)</strong></summary>

${swaggerLineDiff ? '```diff\n' + swaggerLineDiff + '\n```' : '_No changes detected_'}

</details>

---

<details>
<summary><strong>📝 Full Description (Changed Tags in swagger.tags.ts)</strong></summary>

${swaggerTagsFullDescription ? '```text\n' + swaggerTagsFullDescription + '\n```' : '_No changes detected_'}

</details>

---

<details>
<summary><strong>🧩 Decorator Swagger Changes (Controller / DTO)</strong></summary>

${decoratorDiff ? '```diff\n' + decoratorDiff + '\n```' : '_No decorator changes detected_'}

</details>
`;
}

function formatList(txt: string) {
  if (!txt) return '_No changes detected_';
  return txt.split('\n').map(t => `- ${t}`).join('\n');
}
