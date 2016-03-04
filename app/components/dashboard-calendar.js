import moment from 'moment';
import Ember from 'ember';
import DS from 'ember-data';
import momentFormat from 'ember-moment/computeds/format';

const { Component, computed, isPresent, RSVP, inject } = Ember;
const { PromiseObject } = DS;
const { service } = inject;

export default Component.extend({
  init() {
    this._super(...arguments);
    //do these on setup otherwise tests were failing because
    //the old filter value hung around
    this.set('selectedSessionTypes', []);
    this.set('selectedCourseLevels', []);
    this.set('selectedCohorts', []);
    this.set('selectedCourses', []);
  },
  userEvents: service(),
  schoolEvents: service(),
  currentUser: service(),
  store: service(),
  i18n: service(),
  selectedDate: null,
  selectedView: null,

  dueTranslation: computed('i18n.locale', function(){
    return this.get('i18n').t('calendar.dueThisDay');
  }),
  dayTranslation: computed('i18n.locale', function(){
    return this.get('i18n').t('calendar.day');
  }),
  weekTranslation: computed('i18n.locale', function(){
    return this.get('i18n').t('calendar.week');
  }),
  monthTranslation: computed('i18n.locale', function(){
    return this.get('i18n').t('calendar.month');
  }),
  loadingEventsTranslation: computed('i18n.locale', function(){
    return this.get('i18n').t('calendar.loadingEvents');
  }),
  icsInstructionsTranslation: computed('i18n.locale', function(){
    return this.get('i18n').t('calendar.icsInstructions');
  }),
  fromTimeStamp: computed('selectedDate', 'selectedView', function(){
    return moment(this.get('selectedDate')).startOf(this.get('selectedView')).subtract(this.get('skew'), 'days').unix();
  }),
  toTimeStamp: computed('selectedDate', 'selectedView', function(){
    return moment(this.get('selectedDate')).endOf(this.get('selectedView')).add(this.get('skew'), 'days').unix();
  }),
  clockSkew: computed('selectedView', function(){
    if(this.set('selectedView') === 'month'){
      return 6;
    }

    return 1;
  }),
  calendarDate: momentFormat('selectedDate', 'YYYY-MM-DD'),
  ourEvents: computed('mySchedule', 'fromTimeStamp', 'toTimeStamp', 'selectedSchool', 'selectedView', function(){
    if(this.get('mySchedule')) {
      return DS.PromiseArray.create({
        promise: this.get('userEvents').getEvents(this.get('fromTimeStamp'), this.get('toTimeStamp'))
      });
    } else {
      let deferred = RSVP.defer();
      this.get('selectedSchool').then(school => {
        this.get('schoolEvents').getEvents(school.get('id'), this.get('fromTimeStamp'), this.get('toTimeStamp')).then(events => {
          if(this.get('selectedView') === 'day'){
            deferred.resolve(events);
          } else {
            let sessionEvents = {};
            let promises = [];
            events.forEach(event => {
              if(event.name === 'Scheduled'){
                let sid = 'sched' + moment(event.startDate).unix() + moment(event.endDate).unix();
                if(!(sid in sessionEvents)){
                  sessionEvents[sid] = [];
                }
                sessionEvents[sid].pushObject(event);
              }
              else {
                promises.pushObject(this.get('schoolEvents').getSessionForEvent(event).then(session => {
                  let sid = session.get('id') + moment(event.startDate).format() +
                      moment(event.endDate).format();
                  if(!(sid in sessionEvents)){
                    sessionEvents[sid] = [];
                  }
                  sessionEvents[sid].pushObject(event);
                }));
              }
            });
            RSVP.all(promises).then(() => {
              let singleEventPerSessionAndTime = [];
              for(let id in sessionEvents){
                singleEventPerSessionAndTime.pushObject(sessionEvents[id].get('firstObject'));
              }
              deferred.resolve(singleEventPerSessionAndTime);
            });
          }
        });
      });
      return DS.PromiseArray.create({
        promise: deferred.promise
      });
    }
  }),
  filteredEvents: computed(
    'ourEvents.[]',
    'eventsWithSelectedSessionTypes.[]',
    'eventsWithSelectedCourseLevels.[]',
    'eventsWithSelectedCohorts.[]',
    'eventsWithSelectedCourses.[]',
    function() {
      let defer = RSVP.defer();
      let promises = [];
      let eventTypes = [
        'eventsWithSelectedSessionTypes',
        'eventsWithSelectedCourseLevels',
        'eventsWithSelectedCohorts',
        'eventsWithSelectedCourses',
      ];
      let allFilteredEvents = [];
      eventTypes.forEach(name => {
        promises.pushObject(this.get(name).then(events => {
          allFilteredEvents.pushObject(events);
        }));
      });

      RSVP.all(promises).then(()=> {
        let ourEvents = this.get('ourEvents');
        if(!ourEvents){
          defer.resolve([]);
        } else {
          ourEvents.then(events => {
            let filteredEvents = events.filter(event => {
              return allFilteredEvents.every(arr => {
                let bool = arr.contains(event);

                return bool;
              });
            });
            defer.resolve(filteredEvents);
          });
        }
      });
      return DS.PromiseArray.create({
        promise: defer.promise
      });
    }
  ),

  eventsWithSelectedSessionTypes: computed('ourEvents.[]', 'selectedSessionTypes.[]', function(){
    let selectedSessionTypes = this.get('selectedSessionTypes').mapBy('id');
    let events = this.get('ourEvents');
    if(selectedSessionTypes.length === 0) {
      return events;
    }
    let matchingEvents = [];
    let defer = RSVP.defer();
    let promises = [];
    events.forEach(event => {
      if (event.ilmEvent || event.offering) {
        promises.pushObject(this.get('userEvents').getSessionTypeIdForEvent(event).then(id => {
          if (selectedSessionTypes.contains(id)) {
            matchingEvents.pushObject(event);
          }
        }));
      }
    });

    RSVP.all(promises).then(()=> {
      defer.resolve(matchingEvents);
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  }),
  eventsWithSelectedCourseLevels: computed('ourEvents.[]', 'selectedCourseLevels.[]', function(){
    let selectedCourseLevels = this.get('selectedCourseLevels');
    let events = this.get('ourEvents');
    if(selectedCourseLevels.length === 0) {
      return events;
    }
    let matchingEvents = [];
    let defer = RSVP.defer();
    let promises = [];
    events.forEach(event => {
      if (event.ilmEvent || event.offering) {
        promises.pushObject(this.get('userEvents').getCourseLevelForEvent(event).then(level => {
          if (selectedCourseLevels.contains(level)) {
            matchingEvents.pushObject(event);
          }
        }));
      }
    });

    RSVP.all(promises).then(()=> {
      defer.resolve(matchingEvents);
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  }),
  eventsWithSelectedCohorts: computed('ourEvents.[]', 'selectedCohorts.[]', function(){
    let selectedCohorts = this.get('selectedCohorts').mapBy('id');
    let events = this.get('ourEvents');
    if(selectedCohorts.length === 0) {
      return events;
    }
    let matchingEvents = [];
    let defer = RSVP.defer();
    let promises = [];
    events.forEach(event => {
      if (event.ilmEvent || event.offering) {
        promises.pushObject(this.get('userEvents').getCohortIdsForEvent(event).then(cohorts => {
          if (cohorts.any(cohortId => {
            return selectedCohorts.contains(cohortId);
          })) {
            matchingEvents.pushObject(event);
          }
        }));
      }
    });

    RSVP.all(promises).then(()=> {
      defer.resolve(matchingEvents);
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  }),
  eventsWithSelectedCourses: computed('ourEvents.[]', 'selectedCourses.[]', function(){
    let selectedCourses = this.get('selectedCourses').mapBy('id');
    let events = this.get('ourEvents');
    if(selectedCourses.length === 0) {
      return events;
    }
    let matchingEvents = [];
    let defer = RSVP.defer();
    let promises = [];
    events.forEach(event => {
      if (event.ilmEvent || event.offering) {
        promises.pushObject(this.get('userEvents').getCourseIdForEvent(event).then(courseId => {
          if (selectedCourses.contains(courseId)) {
            matchingEvents.pushObject(event);
          }
        }));
      }
    });

    RSVP.all(promises).then(()=> {
      defer.resolve(matchingEvents);
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  }),

  selectedSessionTypes: [],
  sessionTypes: computed('selectedSchool.sessionTypes.[]', 'selectedSessionTypes.[]', function(){
    return DS.PromiseArray.create({
      promise: this.get('selectedSchool').then(school => {
        return school.get('sessionTypes').then( types => {
          return types.sortBy('title');
        });
      })
    });
  }),
  selectedCourseLevels: [],
  courseLevels: computed('selectedCourseLevels.[]', function(){
    let levels = [];
    for(let i =1; i <=5; i++){
      levels.pushObject(i);
    }

    return levels;
  }),
  selectedCohorts: [],
  allCohorts: computed('selectedSchool', 'selectedAcademicYear', function(){
    let defer = RSVP.defer();
    this.get('selectedSchool').then(school => {
      this.get('selectedAcademicYear').then(year => {
        school.getCohortsForYear(year.get('title')).then(cohorts => {
          defer.resolve(cohorts.sortBy('displayTitle'));
        });
      });
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  }),
  cohorts: computed('allCohorts.[].displayTitle', 'selectedCohorts.[]', function(){
    return this.get('allCohorts');
  }),
  selectedCourses: [],
  allCourses: computed('selectedSchool', 'selectedAcademicYear', function(){
    let defer = RSVP.defer();
    this.get('selectedSchool').then((school) => {
      this.get('selectedAcademicYear').then((year) => {
        this.get('store').query('course', {
          filters: {
            school: school.get('id'),
            year: year.get('title')
          },
          limit: 1000
        }).then((courses) => {
          defer.resolve(courses.sortBy('title'));
        });
      });
    });
    return DS.PromiseArray.create({
      promise: defer.promise
    });
  }),
  courses: computed('allCourses.[]', 'selectedCourses.[]', function(){
    return this.get('allCourses');
  }),
  selectedSchool: computed('schoolPickedByUser', 'currentUser.model.school', function(){
    let defer = RSVP.defer();

    if(this.get('schoolPickedByUser')){
      defer.resolve(this.get('schoolPickedByUser'));
    } else {
      this.get('currentUser').get('model').then(user => {
        user.get('school').then(school => {
          defer.resolve(school);
        });
      });
    }

    return PromiseObject.create({
      promise: defer.promise
    });
  }),
  hasMoreThanOneSchool: computed.gt('schools.length', 1),
  allSchools: computed(function(){
    return DS.PromiseArray.create({
      promise: this.get('currentUser.model').then(user => {
        return user.get('schools').then(schools => {
          return schools;
        });
      })
    });
  }),
  schools: computed('allSchools.[]', 'selectedSchool', function(){
    return this.get('allSchools').sortBy('title');
  }),
  selectedAcademicYear: computed('academicYearSelectedByUser', function(){
    if(this.get('academicYearSelectedByUser')){
      //wrap it in a proxy so the is-equal comparison works the same as the promise
      return DS.PromiseObject.create({
        promise: RSVP.resolve(this.get('academicYearSelectedByUser'))
      });
    }

    return DS.PromiseObject.create({
      promise: this.get('allAcademicYears').then(years => {
        return years.sortBy('title').get('lastObject');
      })
    });
  }),
  allAcademicYears: computed(function(){
    return this.get('store').findAll('academic-year');
  }),
  academicYears: computed('allAcademicYears.[]', 'academicYearSelectedByUser', function(){
    return DS.PromiseArray.create({
      promise: this.get('allAcademicYears').then(years => {
        return years.sortBy('title');
      })
    });
  }),

  showClearFilters: computed('selectedCourses.[]', 'selectedSessionTypes.[]', 'selectedCourseLevels.[]', 'selectedCohorts.[]', {
    get() {
      const a = this.get('selectedSessionTypes');
      const b = this.get('selectedCourseLevels');
      const c = this.get('selectedCohorts');
      const d = this.get('selectedCourses');

      let results = a.concat(b, c, d);
      this.set('activeFilters', results);

      return isPresent(results) ? true : false;
    }
  }).readOnly(),

  activeFilters: null,

  filterTags: computed('activeFilters', {
    get() {
      const activeFilters = this.get('activeFilters');

      return activeFilters.map((filter) => {
        let hash = {};
        hash.filter = filter;

        if (typeof filter === 'number') {
          hash.class = 'tag-course-level';
          hash.name = `Course Level ${filter}`;
        } else {
          let model = filter.get('constructor.modelName');

          switch (model) {
          case 'session-type':
            hash.class = 'tag-session-type';
            hash.name = filter.get('title');
            break;
          case 'cohort':
            hash.class = 'tag-cohort';
            hash.name = `${filter.get('displayTitle')} ${filter.get('programYear.program.title')}`;
            break;
          case 'course':
            hash.class = 'tag-course';
            hash.name = filter.get('title');
            break;
          }
        }

        return hash;
      });
    }
  }),

  actions: {
    changeDate(newDate){
      this.sendAction('changeDate', newDate);
    },
    changeView(newView){
      this.sendAction('changeView', newView);
    },
    selectEvent(event){
      this.sendAction('selectEvent', event);
    },
    toggleShowFilters() {
      this.sendAction('toggleShowFilters');
    },
    toggleMySchedule() {
      this.sendAction('toggleMySchedule');
    },
    toggleCourseFilters() {
      this.sendAction('toggleCourseFilters');
    },
    toggleSessionType(sessionType){
      if(this.get('selectedSessionTypes').contains(sessionType)){
        this.get('selectedSessionTypes').removeObject(sessionType);
      } else {
        this.get('selectedSessionTypes').pushObject(sessionType);
      }
    },
    toggleCourseLevel(level){
      if(this.get('selectedCourseLevels').contains(level)){
        this.get('selectedCourseLevels').removeObject(level);
      } else {
        this.get('selectedCourseLevels').pushObject(level);
      }
    },
    toggleCohort(cohort){
      if(this.get('selectedCohorts').contains(cohort)){
        this.get('selectedCohorts').removeObject(cohort);
      } else {
        this.get('selectedCohorts').pushObject(cohort);
      }
    },
    toggleCourse(course){
      if(this.get('selectedCourses').contains(course)){
        this.get('selectedCourses').removeObject(course);
      } else {
        this.get('selectedCourses').pushObject(course);
      }
    },

    pickSchool() {
      let selectedEl = this.$('.calendar-school-picker select')[0];
      let selectedIndex = selectedEl.selectedIndex;
      const schools = this.get('schools');
      let school = schools.toArray()[selectedIndex];

      this.sendAction('changeSchool', school);
    },

    changeSelectedYear() {
      let selectedEl = this.$('.calendar-year-picker select')[0];
      let selectedIndex = selectedEl.selectedIndex;
      this.get('academicYears').then(years => {
        let year = years.toArray()[selectedIndex];

        this.sendAction('changeAcademicYear', year);
      });
    },

    clearFilters() {
      const selectedCourses = [];
      const selectedSessionTypes = [];
      const selectedCourseLevels = [];
      const selectedCohorts = [];

      this.setProperties({ selectedCourses, selectedSessionTypes, selectedCourseLevels, selectedCohorts });
    },

    removeFilter(filter) {
      if (typeof filter === 'number') {
        this.send('toggleCourseLevel', filter);
      } else {
        let model = filter.get('constructor.modelName');

        switch (model) {
        case 'session-type':
          this.send('toggleSessionType', filter);
          break;
        case 'cohort':
          this.send('toggleCohort', filter);
          break;
        case 'course':
          this.send('toggleCourse', filter);
          break;
        }
      }
    }
  }
});
