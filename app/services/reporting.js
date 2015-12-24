import Ember from 'ember';
import DS from 'ember-data';
import { pluralize } from 'ember-inflector';

const { inject, Service, RSVP, computed } = Ember;
const { PromiseArray } = DS;
const { service } = inject;

export default Service.extend({
  store: service(),
  currentUser: service(),
  reportsList: computed('currentUser.model.reports.[]', function(){
    let defer = RSVP.defer();
    this.get('currentUser').get('model').then( user => {
      user.get('reports').then( reports => {
        defer.resolve(reports);
      });
    });
    return PromiseArray.create({
      promise: defer.promise
    });
  }),
  getResults(report){
    const subject = report.get('subject');
    const object = report.get('prepositionalObject');
    const objectId = report.get('prepositionalObjectTableRowId');
    let defer = RSVP.defer();
    report.get('school').then(school => {
      this.get('store').query(
        this.getModel(subject),
        this.getQuery(subject, object, objectId, school)
      ).then(results => {
        let mapper = pluralize(subject.camelize()) + 'Results';
        this[mapper](results).then(mappedResults => {
          defer.resolve(mappedResults.sortBy('value'));
        });
      });
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  },
  getModel(subject){
    let model = subject.dasherize();
    if(model === 'instructor'){
      model = 'user';
    }
    if(model === 'mesh-term'){
      model = 'mesh-descriptor';
    }
    
    return model;
  },
  getQuery(subject, object, objectId, school){
    let query = {
      limit: 1000,
      filters: {}
    };
    
    if(object && objectId){
      let what = pluralize(object.camelize());
      if(object === 'mesh term'){
        what = 'meshDescriptors';
      }
      if(subject = 'session' && object === 'session type'){
        what = 'sessionType';
      }
      query.filters[what] = objectId;
    } else {
      if(subject !== 'mesh term' && subject !== 'instructor' && subject !== 'learning material' && school){
        query.filters['schools'] = [school.get('id')];  
      }
    }
    
    return query;
  },
  coursesResults(results){
    const canViewCourses = this.get('currentUser.canViewCourses');
    let map = results.map(course => {
      let rhett = {};
      rhett.value = course.get('academicYear') + ' ' + course.get('title');
      if(canViewCourses){
        rhett.route = 'course';
        rhett.model = course;
      }
      
      return rhett;
    });
    
    return RSVP.resolve(map);
  },
  sessionsResults(results){
    const canView = this.get('currentUser.canViewCourses');
    let map = results.map(item => {
      return new RSVP.Promise(resolve => {
        let rhett = {};
        item.get('course').then(course => {
          rhett.value = course.get('academicYear') + ' ' + course.get('title') + ' ' + item.get('title');
          if(canView){
              rhett.route = 'session';
              rhett.model = course;
              rhett.model2 = item;
          }
          resolve(rhett);
        });
      });
    });
    
    return RSVP.all(map);
  },
  programsResults(results){
    const canView = this.get('currentUser.canViewPrograms');
    let map = results.map(item => {
      return new RSVP.Promise(resolve => {
        let rhett = {};
        item.get('school').then(school => {
          rhett.value = school.get('title') + ': ' + item.get('title');
          if(canView){
              rhett.route = 'program';
              rhett.model = item;
          }
          resolve(rhett);
        });
      });
    });
    
    return RSVP.all(map);
  },
  programYearsResults(results){
    const canView = this.get('currentUser.canViewPrograms');
    let map = results.map(item => {
      return new RSVP.Promise(resolve => {
        let rhett = {};
        item.get('program').then(program => {
          program.get('school').then(school => {
            rhett.value = school.get('title') + ' ' + program.get('title') + ' ' + item.get('classOfYear');
            if(canView){
                rhett.route = 'programYear';
                rhett.model = program;
                rhett.model2 = item;
            }
            resolve(rhett);
          });
        });
        
      });
    });
    
    return RSVP.all(map);
  },
  instructorsResults(results){
    let map = results.map( result => {
      return {
        value: result.get('fullName')
      };
    });
    return RSVP.resolve(map);
  },
  titleResults(results){
    let map = results.map( result => {
      return {
        value: result.get('title')
      };
    });
    return RSVP.resolve(map);
  },
  instructorGroupsResults(results){
    return this.titleResults(results);
  },
  learningMaterialsResults(results){
    return this.titleResults(results);
  },
  competenciesResults(results){
    return this.titleResults(results);
  },
  topicsResults(results){
    return this.titleResults(results);
  },
  settionTypesResults(results){
    return this.titleResults(results);
  },
  meshTermsResults(results){
    let map = results.map( result => {
      return {
        value: result.get('name')
      };
    });
    return RSVP.resolve(map);
  }
});