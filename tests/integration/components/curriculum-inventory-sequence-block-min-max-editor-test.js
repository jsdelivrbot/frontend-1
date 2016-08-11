import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('curriculum-inventory-sequence-block-min-max-editor', 'Integration | Component | curriculum inventory sequence block min max editor', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{curriculum-inventory-sequence-block-min-max-editor}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#curriculum-inventory-sequence-block-min-max-editor}}
      template block text
    {{/curriculum-inventory-sequence-block-min-max-editor}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
