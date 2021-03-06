/* eslint ember/order-in-components: 0 */
import { A } from '@ember/array';
import Component from '@ember/component';
import { computed } from '@ember/object';

export default Component.extend({
  selectedItems: A(),
  item: null,
  selected: computed('item', 'selectedItems.[]', function(){
    return this.get('selectedItems').includes(this.item);
  }),
  click() {
    this.action(this.get('item'));
  }
});
