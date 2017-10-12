import Component from '@ember/component';

export default Component.extend({
  multiModeSupported: false,
  fillModeSupported: false,
  singleMode: true,
  tagName: 'section',
  classNames: ['new-learnergroup', 'new-result', 'form-container'],

  actions: {
    generateNewLearnerGroups(num){
      this.sendAction('generateNewLearnerGroups', num);
    }
  }
});
