import Ember from 'ember';
import AuthenticatedRouteMixin from 'simple-auth/mixins/authenticated-route-mixin';

export default Ember.Route.extend(AuthenticatedRouteMixin, {
  i18n: Ember.inject.service(),
  availableTopics: [],
  afterModel: function(course){
    var self = this;
    var deferred = Ember.RSVP.defer();
    Ember.run.later(deferred.resolve, function() {
      var resolve = this;
      course.get('school').then(function(school){
        var promises = {
          'availableTopics': school.get('topics')
        };
        Ember.RSVP.hash(promises).then(function(hash){
          if(!self.get('isDestroyed')){
            self.set('availableTopics', hash.availableTopics);
          }
          resolve();
        });
      });

    }, 500);
    return deferred.promise;
  },
  setupController: function(controller, model){
    controller.set('model', model);
    controller.set('availableTopics', this.get('availableTopics'));
    this.controllerFor('application').set('pageTitleTranslation', 'navigation.courses');
    this.controllerFor('course').set('showBackToCourseListLink', true);
  }
});
