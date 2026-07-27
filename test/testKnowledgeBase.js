const test = require('node:test');
const assert = require('node:assert/strict');

const { ORIGIN_ONE_KNOWLEDGE_BASE } = require('../src/knowledgeBase');
const {
  ORIGIN_ONE_SOLUTION_CATALOG,
  QUALIFICATION_QUESTIONS,
  renderSolutionCatalogForPrompt
} = require('../src/solutionCatalog');

test('el catálogo cubre las áreas prioritarias de Origin One', () => {
  const areas = ORIGIN_ONE_SOLUTION_CATALOG.map(item => item.area);
  assert.ok(areas.includes('Ventas y desarrollo de negocio'));
  assert.ok(areas.includes('Operaciones y cadena de suministro'));
  assert.ok(areas.includes('Marketing, contenido y comunidad'));
  assert.ok(areas.includes('Sistemas a la medida e integración'));
  assert.ok(areas.includes('Origin Studio'));
});

test('la base de conocimiento incluye catálogo, calificación y límites', () => {
  const rendered = renderSolutionCatalogForPrompt();
  assert.match(ORIGIN_ONE_KNOWLEDGE_BASE, /Catálogo de oportunidades/);
  assert.match(ORIGIN_ONE_KNOWLEDGE_BASE, /patrones de solución, no promesas/i);
  assert.match(rendered, /¿Qué tarea o fricción se repite cada semana\?/);
  assert.ok(QUALIFICATION_QUESTIONS.length >= 6);
});
