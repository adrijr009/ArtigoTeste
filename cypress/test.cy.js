import 'cypress-plugin-tab';
import 'cypress-axe';
import 'cypress-real-events';
const fs = require('fs');

const urls = [
  'https://www.cge.ce.gov.br/',
  'https://www.casacivil.ce.gov.br/conselhos/',
  'https://www.casacivil.ce.gov.br/diario-oficial/'
];

Cypress.on('uncaught:exception', () => false);

Cypress._.each(urls, (url) => {
  describe(`Accessibility tests for ${url}`, () => {
    let fullReport = '';
    let reportHTML = '';
    let sanitizedUrl = url.replace(/\W+/g, '_');

    beforeEach(() => {
      cy.viewport(1920, 1080);
      cy.visit(url);
      cy.injectAxe();
    });

    after(() => {
      // Envolve todo o conteúdo HTML
      const completeHTML = `
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório de Acessibilidade</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1, h2 { color: #333; }
            .violation, .tab, .button { border: 1px solid #ccc; padding: 10px; margin-bottom: 15px; }
            pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>Relatório de Acessibilidade - ${url}</h1>
          <pre>${fullReport}</pre>
          ${reportHTML}
        </body>
        </html>
      `;

      cy.writeFile(`cypress/reports/final-report-${sanitizedUrl}.html`, completeHTML, 'utf-8');
    });

    it('Accessibility Violations', () => {
      cy.wait(2000);
      cy.checkA11y(null, null, (violations) => {
        fullReport += `=== Relatório de Acessibilidade - ${url} ===\n\n`;
        fullReport += `Total de violações: ${violations.length}\n\n`;

        violations.forEach(({ id, impact, description, nodes, tags, help, helpUrl }) => {
          const wcagLevel = tags.includes('wcag2a') ? 'A' :
                            tags.includes('wcag2aa') ? 'AA' :
                            tags.includes('wcag2aaa') ? 'AAA' : 'Desconhecido';

          fullReport += `ID: ${id}\nImpacto: ${impact}\nNível WCAG: ${wcagLevel}\nDescrição: ${description}\nSugestão: ${help}\nMais informações: ${helpUrl}\nTags: ${tags.join(', ')}\n`;

          reportHTML += `
            <div class="violation">
              <h2>${description} (${id})</h2>
              <p><strong>Impacto:</strong> ${impact}</p>
              <p><strong>Nível WCAG:</strong> ${wcagLevel}</p>
              <p><strong>Tags:</strong> ${tags.join(', ')}</p>
              <p><strong>Sugestão:</strong> ${help}</p>
              <p><strong>Mais informações:</strong> <a href="${helpUrl}" target="_blank">${helpUrl}</a></p>
              <h3>Elementos afetados:</h3>
              <ul>
          `;

          nodes.forEach(({ target, html }) => {
            fullReport += `  - Elemento: ${target.join(', ')}\n    Código: ${html}\n`;
            reportHTML += `
              <li>
                <p><strong>Elemento:</strong> ${target.join(', ')}</p>
                <pre>${html}</pre>
              </li>
            `;
          });

          fullReport += `---------------------------------------------------------------------------\n\n`;
          reportHTML += '</ul></div>';
        });
      }, { skipFailures: true });
    });

    it('Navigate in order using Tab', () => {
      cy.wait(2000);
      fullReport += `=== Relatório de Navegação via TAB - ${url} ===\n\n`;
      reportHTML += `<div class="tab"><h2>Navegação via TAB</h2><ul>`;

      cy.get('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        .filter(':visible')
        .not('[disabled]')
        .then(($elements) => {
          cy.wrap($elements).each(($el, index) => {
            const label = $el.text().trim() || $el.attr('aria-label') || $el.attr('placeholder') || 'Sem descrição';
            const tagName = $el.prop('tagName');
            const id = $el.attr('id') ? `#${$el.attr('id')}` : '';
            const className = $el.attr('class') ? `.${$el.attr('class').split(' ').join('.')}` : '';
            const selector = `${tagName}${id}${className}`;

            fullReport += `Elemento ${index + 1}: ${label}\n  → Seletor: ${selector}\n  → HTML: ${$el.prop('outerHTML').trim().slice(0, 300)}...\n\n`;
            reportHTML += `<li><strong>${label}</strong> → ${selector}</li>`;

            cy.wrap($el).focus().should('be.focused');
            cy.wrap($el).tab();
          });
        });

      reportHTML += '</ul></div>';
    });

    it('Checking Button Interaction', () => {
      cy.wait(2000);
      fullReport += `=== Relatório de Interação com Botões - ${url} ===\n\n`;
      reportHTML += `<div class="button"><h2>Interação com Botões</h2><ul>`;

      cy.get('button, [role="button"]')
        .filter(':visible')
        .not('[disabled], [aria-expanded], [data-role="none"]')
        .each(($btns, index) => {
          const label = $btns.text().trim() || $btns.attr('aria-label') || 'Sem descrição';
          const button = Cypress.$($btns);
          const tagName = button.prop('tagName');
          const id = button.attr('id') ? `#${button.attr('id')}` : '';
          const className = button.attr('class') ? `.${button.attr('class').split(' ').join('.')}` : '';
          const selector = `${tagName}${id}${className}`;

          const initial = {
            color: button.css('color'),
            backgroundColor: button.css('background-color'),
            borderColor: button.css('border-color'),
            opacity: button.css('opacity'),
            textDecoration: button.css('text-decoration')
          };

          cy.wrap(button).should('be.visible').realHover();

          cy.wrap(button).should(($el) => {
            const current = {
              color: Cypress.$($el).css('color'),
              backgroundColor: Cypress.$($el).css('background-color'),
              borderColor: Cypress.$($el).css('border-color'),
              opacity: Cypress.$($el).css('opacity'),
              textDecoration: Cypress.$($el).css('text-decoration')
            };

            const changed = Object.keys(initial).some(key => initial[key] !== current[key]);

            fullReport += `Botão ${index + 1}: ${label}\n  → Seletor: ${selector}\n  → HTML: ${button.prop('outerHTML').trim().slice(0, 300)}...\n`;
            fullReport += changed ? '  ✅ Mudança detectada ao passar o mouse.\n\n' : '  ⚠️ Nenhuma mudança detectada!\n\n';

            reportHTML += `<li><strong>${label}</strong> (${selector}) → ${changed ? '✅ Mudança detectada' : '⚠️ Sem mudança detectada'}</li>`;

            expect(changed).to.be.true;
          });
        });

      reportHTML += '</ul></div>';
    });
  });
});
