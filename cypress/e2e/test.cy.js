import 'cypress-plugin-tab';
import 'cypress-axe';
import 'cypress-real-events';
const fs = require('fs');

const config = require('../URLs/urls.json');
const urls = config.urls;

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
      cy.wait(2000);

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

    it('Simulate navigation via Tab', () => {
      cy.log('Iniciando teste de navegação com TAB manual');
      cy.wait(2000);

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

          const processElement = (index) => {
            if (index >= total) return; // fim da recursão

            const el = $elements[index];
            const $el = Cypress.$(el);

            const label = $el.text().trim() || $el.attr('aria-label') || $el.attr('placeholder') || 'Sem descrição';
            const tagName = $el.prop('tagName');
            const id = $el.attr('id') ? `#${$el.attr('id')}` : '';
            const className = $el.attr('class') ? `.${$el.attr('class').split(' ').join('.')}` : '';
            const selector = `${tagName}${id}${className}`;
            const htmlSnippet = $el.prop('outerHTML').trim().slice(0, 300);

            let report;
            report += `Elemento ${index + 1} de ${total}: ${label}\n`;
            report += `  → Seletor: ${selector}\n`;
            report += `  → HTML: ${htmlSnippet}...\n`;

            const isFocusable = ($el) => {
              const tag = $el.prop('tagName').toLowerCase();
              const isLinkWithHref = tag === 'a' && $el.attr('href');
              const hasTabindex = $el.attr('tabindex') !== undefined;
              const isNaturallyFocusable = ['input', 'select', 'textarea', 'button'].includes(tag);
              return isLinkWithHref || hasTabindex || isNaturallyFocusable;
            };

            if (!isFocusable($el)) {
              report += `⚠️ AVISO: Elemento não é focável.\n`;
              report += `_______________________________________________________________________\n`;
              fullReport += `\n${report}`;
              processElement(index + 1);
              return;
            }

            cy.wrap($el)
              .scrollIntoView()
              .then(() => {
                $el[0].focus();

                cy.focused().then(($focused) => {
                  if (!$focused.is(':visible')) {
                    report += `⚠️ ERRO: O elemento focado não está visível!\n`;
                    report += `    Era esperado o Elemento ${index + 1} de ${total}\n`;
                  } else if ($focused[0] !== $el[0]) {
                    report += `❌ ERRO: O foco não foi aplicado corretamente \n`;
                  } else {
                    report += `✅ Foco aplicado com sucesso \n`;
                  }
                  report += `_______________________________________________________________________\n`;
                  fullReport += `\n${report}`;
                  processElement(index + 1); // chama o próximo na sequência
                });
              });
          };
          // Inicia a recursão no primeiro elemento
          processElement(0);
        });
    });

    it('Checking Button Interaction', () => {
      cy.log('Teste interaçao de botão');
      cy.wait(2000);

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
            color: button.css('color'), //cor do texto
            backgroundColor: button.css('background-color'), //cor do fundo
            borderColor: button.css('border-color'), //cor da borda
            border: button.css('border'), //tamanho da borda
            opacity: button.css('opacity'), // transparencia
            textDecoration: button.css('text-decoration'),
            textDecorationLine: button.css('text-decoration-line'),

            fontWeight: button.css('font-weight'), //Alteração na Forma da fonte: Normal, Negrito, Itálico, Etc.
            transform: button.css('transform'), //Caputar efeitos como scale, rotate e translate
            boxShadow: button.css('box-shadow'), //sombras que aparecem no hover
            cursor: button.css('cursor'), //mouse vira um pointer
            textShadow: button.css('text-shadow'), //botões com efeito de destaque
            outline: button.css('outline'), //contorno
            borderRadius: button.css('border-radius'), //borda arrendondada
            transition: button.css('transition') //transição
          };

          cy.wrap(button).should('be.visible').realHover();
          cy.wait(300);

          cy.wrap(button).then(($el) => {
            const current = {
              color: $el.css('color'),
              backgroundColor: $el.css('background-color'),
              borderColor: $el.css('border-color'),
              border: $el.css('border'),
              opacity: $el.css('opacity'),
              textDecoration: $el.css('text-decoration'),
              textDecorationLine: $el.css('text-decoration-line'),
              fontWeight: $el.css('font-weight'),
              
              transform: $el.css('transform'),
              boxShadow: $el.css('box-shadow'),
              cursor: $el.css('cursor'),
              textShadow: $el.css('text-shadow'),
              outline: $el.css('outline'),
              borderRadius: $el.css('border-radius'),
              transition: $el.css('transition')
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