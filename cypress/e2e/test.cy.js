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
    let sanitizedUrl = url.replace(/\W+/g, '_');

    beforeEach(() => {
      cy.viewport(1920, 1080);
      cy.visit(url);
      cy.injectAxe();
    });

    after(() => {
      cy.writeFile(`cypress/reports/final-report-${sanitizedUrl}.txt`, fullReport, 'utf-8');
    });

    it('Accessibility Violations', () => {
      cy.log('Teste de acessibilidade');
      cy.wait(2000);

      cy.checkA11y(null, null, (violations) => {
        fullReport += `=== Relatório de Acessibilidade - ${url} ===\n\n`;
        fullReport += `Total de violações: ${violations.length}\n\n`;

        violations.forEach(({ id, impact, description, nodes, tags, help, helpUrl }) => {
          const wcagLevel = tags.includes('wcag2a') ? 'A' :
            tags.includes('wcag2aa') ? 'AA' :
              tags.includes('wcag2aaa') ? 'AAA' : 'Desconhecido';

          fullReport += `ID: ${id}\n`;
          fullReport += `Impacto: ${impact}\n`;
          fullReport += `Nível WCAG: ${wcagLevel}\n`;
          fullReport += `Descrição: ${description}\n`;
          fullReport += `Sugestão: ${help}\n`;
          fullReport += `Mais informações: ${helpUrl}\n`;
          fullReport += `Tags: ${tags.join(', ')}\n`;

          nodes.forEach(({ target, html }) => {
            fullReport += `  - Elemento: ${target.join(', ')}\n`;
            fullReport += `    Código: ${html}\n`;
          });

          fullReport += `---------------------------------------------------------------------------\n\n`;
        });
      }, { skipFailures: true });
    });

    it('Navigate in order using Tab', () => {
      cy.log('Teste em TAB');
      cy.wait(2000);

      fullReport += `=== Relatório de Navegação via TAB - ${url} ===\n\n`;

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

            fullReport += `Elemento ${index + 1}: ${label}\n`;
            fullReport += `  → Seletor: ${selector}\n`;
            fullReport += `  → HTML: ${$el.prop('outerHTML').trim().slice(0, 300)}...\n\n`;

            cy.wrap($el).focus().should('be.focused');
            cy.wrap($el).tab();
          });
        });
    });

    it('Checking Button Interaction', () => {
      cy.log('Teste interaçao de botão');
      cy.wait(2000);

      fullReport += `\n\n===================================================\n`;
      fullReport += `=== Relatório de Interação com Botões - ${url} ===\n\n`;

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
            fullReport += `Botão ${index + 1}: ${label}\n`;
            fullReport += `  → Seletor: ${selector}\n`;
            fullReport += `  → HTML: ${button.prop('outerHTML').trim().slice(0, 300)}...\n`;
            fullReport += changed ? '  ✅ Mudança detectada ao passar o mouse.\n\n' : '  ⚠️ Nenhuma mudança detectada!\n\n';

            expect(changed).to.be.true;
          });
        });
    });

  });
});