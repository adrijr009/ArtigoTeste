import 'cypress-plugin-tab';
import 'cypress-axe';
import 'cypress-real-events';
const fs = require('fs');

const urls = [
  'https://transparencia.fortaleza.ce.gov.br/',
  'https://compras.sepog.fortaleza.ce.gov.br/publico/licitacoes.asp',
  'https://www.cge.ce.gov.br/',
  'https://www.cge.ce.gov.br/qualidade/',
  'https://www.gov.br/pt-br',
  'https://portaldatransparencia.gov.br/',
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
      cy.task('generateHtml', {
        fileName: `final-report-${sanitizedUrl}`,
        title: `Relatório de Acessibilidade e Navegação - ${url}`,
        content: fullReport
      });
    });


    it('Accessibility Violations', () => {
      cy.log('Teste de acessibilidade');
      cy.wait(1200);

      cy.checkA11y(null, null, (violations) => {
        fullReport += `===== Relatório de Acessibilidade - ${url} =====\n\n`;
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

          fullReport += `_________________________________________________________________________\n\n`;
        });
      }, { skipFailures: true });
    });

    it('Simula navegação via Tab apenas em elementos visíveis e interativos', () => {
      cy.log('Iniciando teste de navegação com TAB manual');
      cy.wait(1200);

      fullReport += `\n\n===== Relatório de Navegação via TAB - ${url} =====\n\n`;

      const isFocusable = ($el) => {
        const tag = $el.prop('tagName').toLowerCase();
        const isLinkWithHref = tag === 'a' && $el.attr('href');
        const hasTabindex = $el.attr('tabindex') !== undefined;
        const isNaturallyFocusable = ['input', 'select', 'textarea', 'button'].includes(tag);
        return isLinkWithHref || hasTabindex || isNaturallyFocusable;
      };

      cy.get('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        .filter(':visible')
        .not('[disabled]')
        .then(($elements) => {
          const total = $elements.length;

          cy.wrap($elements).each(($el, index) => {
            const label = $el.text().trim() || $el.attr('aria-label') || $el.attr('placeholder') || 'Sem descrição';
            const tagName = $el.prop('tagName');
            const id = $el.attr('id') ? `#${$el.attr('id')}` : '';
            const className = $el.attr('class') ? `.${$el.attr('class').split(' ').join('.')}` : '';
            const selector = `${tagName}${id}${className}`;

            fullReport += `Elemento ${index + 1} de ${total}: ${label}\n`;
            fullReport += `  → Seletor: ${selector}\n`;
            fullReport += `  → HTML: ${$el.prop('outerHTML').trim().slice(0, 300)}...\n`;

            if (!isFocusable($el)) {
              fullReport += `⚠️ AVISO: Elemento ${index + 1} não é focável.\n`;
              fullReport += ` _______________________________________________________________________\n`;
              return;
            }

            fullReport += ` _______________________________________________________________________\n`;

            cy.wrap($el).scrollIntoView().focus().then(() => {
              cy.focused().then(($focused) => {
                const focusedDesc = $focused.text().trim() || $focused.attr('aria-label') || $focused.attr('placeholder') || 'Sem descrição';
                const isSame = $focused[0] === $el[0];

                if (!$focused.is(':visible')) {
                  fullReport += `⚠️ ERRO: O elemento focado não está visível!\n`;
                  fullReport += `    Era esperado o Elemento ${index + 1} de ${total}: ${label}\n`;
                }

                if (!isSame) {
                  fullReport += `❌ ERRO O foco não foi aplicado corretamente no Elemento ${index + 1} de ${total}: ${label}\n`;
                } else {
                  fullReport += `✅ Foco aplicado com sucesso no Elemento ${index + 1} de ${total}: ${label}\n`;
                }
              });
            });
          });
        });
    });

    it('Checking Button Interaction', () => {
      cy.log('Teste interaçao de botão');
      cy.wait(1200);

      fullReport += `\n\n===== Relatório de Interação com Botões - ${url} =====\n\n`;

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
            textDecoration: button.css('text-decoration'),
          };

          cy.wrap(button).should('be.visible').realHover();
          cy.wait(300);

          cy.wrap(button).then(($el) => {
            const current = {
              color: $el.css('color'),
              backgroundColor: $el.css('background-color'),
              borderColor: $el.css('border-color'),
              opacity: $el.css('opacity'),
              textDecoration: $el.css('text-decoration')
            };

            const changed = Object.keys(initial).some(key => initial[key] !== current[key]);

            fullReport += `Botão ${index + 1}: ${label}\n`;
            fullReport += `  → Seletor: ${selector}\n`;
            fullReport += `  → HTML: ${button.prop('outerHTML').trim().slice(0, 300)}...\n`;
            fullReport += changed ? '  ✅ Mudança detectada ao passar o mouse.\n' : '  ⚠️ Nenhuma mudança detectada!\n';
            fullReport += `  ________________________________________________________________________\n\n`;

            // Evita falha do teste interromper o restante
            if (!changed) {
              Cypress.log({ name: 'hover-fail', message: `Botão "${label}" não mudou estilo ao hover.` });
            }
          });

        });
    });

  });
});