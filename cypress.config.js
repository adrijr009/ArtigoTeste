const fs = require('fs');
const path = require('path');

/** @type {import('cypress').defineConfig} */
module.exports = {
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        generateHtml({ fileName, title, content }) {
          const html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <title>${title}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f4f4f4; }
                pre {
                  background: #fff;
                  padding: 1rem;
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  white-space: pre-wrap;
                }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </body>
            </html>
          `;

          const outputDir = path.resolve(__dirname, 'cypress', 'reports');
          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

          const outputPath = path.join(outputDir, `${fileName}.html`);
          fs.writeFileSync(outputPath, html, 'utf-8');
          console.log(`📄 Relatório salvo em: ${outputPath}`);
          return null;
        }
      });
    }
  }
};
