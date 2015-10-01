import moment from 'moment';
import Ember from 'ember';

export default Ember.Component.extend({
  view: null,
  calendarEvents: [],
  date: null,
  isMonthView: Ember.computed.equal('view', 'month'),
  isWeekView: Ember.computed.equal('view', 'week'),
  isDayView: Ember.computed.equal('view', 'day'),
  classNameBindings: ['calendarTypeClass'],
  calendarTypeClass: Ember.computed('view', function(){
    return this.get('view') + '-calendar';
  }),
  scrollCalendar: function(){
    Ember.run.next(function(){
      $(".day-calendar .el-calendar .week").scrollTop(500);
      $(".week-calendar .el-calendar .week").scrollTop(500);
    });
  }.observes('view').on('didInsertElement'),
  fullCalendarDate: Ember.computed('date', function(){
    return moment(this.get('date')).format();
  }),
  weekOf: Ember.computed('date', function(){
    return moment(this.get('fullCalendarDate')).startOf('week').format('MMMM Do YYYY');
  })
});
