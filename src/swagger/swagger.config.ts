import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { execSync } from 'child_process';
import { SwaggerTagDescriptions } from './swagger.tags';

export function setupSwagger(app: INestApplication) {
  // Ambil commit hash yang TERAKHIR menyentuh swagger
  const LAST_COMMIT_HASH = git(`git log -1 --pretty=format:"%H" -- src/swagger`);

  // Kalau belum pernah ada commit ke swagger
  if (!LAST_COMMIT_HASH) {
    console.warn('⚠ Tidak ada commit terkait swagger');
  }

  // Info detail commit
  const AUTHOR = git(`git show -s --pretty=format:"%an" ${LAST_COMMIT_HASH}`);
  const DATE   = git(`git show -s --pretty=format:"%ad" ${LAST_COMMIT_HASH}`);
  const MSG    = git(`git show -s --pretty=format:"%s" ${LAST_COMMIT_HASH}`);

  // File apa saja yg berubah pada commit itu
  const FILE_CHANGES = git(
    `git diff --name-only ${LAST_COMMIT_HASH}~1 ${LAST_COMMIT_HASH} -- src/swagger`
  );

  // Diff baris perubahan commit itu
  const RAW_DIFF = git(
    `git diff ${LAST_COMMIT_HASH}~1 ${LAST_COMMIT_HASH} -- src/swagger`
  );
  const CLEAN_DIFF = cleanDiff(RAW_DIFF);

  // Diff decorator swagger commit itu
  const DECORATOR_RAW = git(
    `git diff ${LAST_COMMIT_HASH}~1 ${LAST_COMMIT_HASH} -- '**/*.ts' | grep -E '^\\+|^\\-' | grep -E '@Api|@ApiProperty|@ApiTags|@ApiResponse' || true`
  );
  const DECORATOR_DIFF = cleanDiff(DECORATOR_RAW);

  const config = new DocumentBuilder()
    .setTitle('DOKUMENTASI API EMKL')
    .setDescription(
      buildDescription(
        AUTHOR,
        DATE,
        MSG,
        FILE_CHANGES,
        CLEAN_DIFF,
        DECORATOR_DIFF
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

// Bersihin diff → hanya + dan -
function cleanDiff(diff: string) {
  if (!diff) return '';
  return diff
    .split('\n')
    .filter(line => line.startsWith('+') || line.startsWith('-'))
    .filter(line => !line.startsWith('+++') && !line.startsWith('---'))
    .join('\n');
}

// Format tampilan swagger
function buildDescription(
  author: string,
  date: string,
  msg: string,
  fileChanges: string,
  lineDiff: string,
  decoratorDiff: string,
) {
  return `
### 🔧 Last Swagger Modification
- **Author:** ${author || '-'}
- **Date:** ${date || '-'}
- **Commit:** ${msg || '-'}

---

<details>
<summary><strong>📄 Changed Swagger Files</strong></summary>

${formatList(fileChanges)}

</details>

---

<details>
<summary><strong>📌 Line Changes (src/swagger)</strong></summary>

${lineDiff ? '```diff\n' + lineDiff + '\n```' : '_No changes detected_'}

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
