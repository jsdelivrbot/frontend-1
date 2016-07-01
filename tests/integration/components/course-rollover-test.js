import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import moment from 'moment';
import Ember from 'ember';
import { openDatepicker } from 'ember-pikaday/helpers/pikaday';
import wait from 'ember-test-helpers/wait';

const { Service, RSVP, Object, run, getOwner } = Ember;
const { resolve } = RSVP;

moduleForComponent('course-rollover', 'Integration | Component | course rollover', {
  integration: true
});

test('it renders', function(assert) {
  let storeMock = Service.extend({
    query(){
      return [];
    }
  });
  this.register('service:store', storeMock);

  let course = Object.create({
    id: 1
  });
  this.set('course', course);

  this.render(hbs`{{course-rollover course=course}}`);

  let thisYear = parseInt(moment().format('YYYY'));

  for (let i=0; i<5; i++){
    assert.equal(this.$(`select:eq(0) option:eq(${i})`).text().trim(), `${thisYear + i} - ${thisYear + 1 + i}`);
  }
});

test('rollover course', function(assert) {
  assert.expect(13);
  let course = Object.create({
    id: 1,
    startDate: moment().hour(0).minute(0).second(0).toDate()
  });

  let ajaxMock = Service.extend({
    request(url, {method, data}){
      let thisYear = parseInt(moment().format('YYYY'));
      assert.equal(url.trim(), `/api/courses/${course.get('id')}/rollover`);
      assert.equal(method, 'POST');
      assert.ok('year' in data);
      assert.equal(data.year, thisYear);
      assert.notOk('newStartDate' in data);
      assert.notOk('skipOfferings' in data);

      return resolve({
        courses: [
          {
            id: 14
          }
        ]
      });
    }
  });
  this.register('service:ajax', ajaxMock);

  let storeMock = Service.extend({
    pushPayload(obj){
      assert.ok('courses' in obj);
      assert.ok(obj.courses.length, 1);
      assert.equal(obj.courses[0].id, 14);
    },
    peekRecord(what, id){
      assert.equal(what, 'course');
      assert.equal(id, 14);

      return Object.create({
        id: 14
      });
    },
    query(){
      return [];
    }
  });
  this.register('service:store', storeMock);
  let flashmessagesMock = Ember.Service.extend({
    success(message){
      assert.equal(message, 'courses.rolloverSuccess');
    }
  });
  this.register('service:flashMessages', flashmessagesMock);


  this.set('course', course);
  this.set('visit', (newCourse) => {
    assert.equal(newCourse.id, 14);
  });
  this.render(hbs`{{course-rollover course=course visit=(action visit)}}`);
  this.$('.done').click();

  return wait();
});

test('disable years when title already exists', function(assert) {
  assert.expect(8);
  const thisYear = parseInt(moment().format('YYYY'));

  let storeMock = Service.extend({
    query(what, {filters}){
      assert.equal(what, 'course');
      assert.ok('title' in filters);
      assert.equal(filters.title, 'to be rolled');

      return [
        {
          id: 2,
          year: thisYear
        },
        {
          id: 3,
          year: thisYear+2
        },
      ];
    }
  });
  this.register('service:store', storeMock);

  let course = Object.create({
    id: 1,
    title: 'to be rolled',
  });
  this.set('course', course);
  this.set('nothing', parseInt);
  this.render(hbs`{{course-rollover course=course visit=(action nothing)}}`);

  let options = this.$('select:eq(0) option');
  assert.ok(options.eq(0).prop('disabled'));
  assert.notOk(options.eq(1).prop('disabled'));
  assert.ok(options.eq(2).prop('disabled'));
  assert.notOk(options.eq(3).prop('disabled'));
  assert.notOk(options.eq(4).prop('disabled'));
});

test('rollover course with new start date', function(assert) {
  assert.expect(8);
  // ensure that rollover date and course start date fall on the same day of the week.
  const courseStartDate = moment().subtract(1, 'week').day(1);
  const rolloverDate = moment(courseStartDate).add(1, 'week');

  let course = Object.create({
    id: 1,
    startDate: courseStartDate.toDate()
  });
  let ajaxMock = Service.extend({
    request(url, {data}){
      assert.ok('newStartDate' in data, 'A new start date was passed.');
      let newStartDate = moment(data.newStartDate);
      assert.equal(
        newStartDate.format('YYYY-MM-DD'),
        rolloverDate.format('YYYY-MM-DD'),
        'New start date is rollover date.'
      );
      return resolve({
        courses: [
          {
            id: 14
          }
        ]
      });
    }
  });
  this.register('service:ajax', ajaxMock);

  let storeMock = Service.extend({
    pushPayload(){},
    peekRecord(){},
    query(){return [];}
  });
  this.register('service:store', storeMock);
  getOwner(this).lookup('service:flash-messages').registerTypes(['success']);

  this.set('course', course);
  this.set('nothing', parseInt);
  this.render(hbs`{{course-rollover course=course visit=(action nothing)}}`);
  const advancedOptions = '.advanced-options';
  const title = `.advanced-options-title`;
  const startDate = `${advancedOptions} input:eq(0)`;

  return new Promise(resolve => {
    run(()=>{
      this.$(title).click();
      wait().then(()=>{
        let interactor = openDatepicker(this.$(startDate));
        assert.equal(
          interactor.selectedYear(),
          courseStartDate.year(),
          'Selected year initialized to course start date year.'
        );
        assert.equal(
          interactor.selectedMonth(),
          courseStartDate.month(),
          'Selected month initialized to course start date month.'
        );
        assert.equal(
          interactor.selectedDay(),
          courseStartDate.date(),
          'Selected day initialized to course start date day.'
        );
        interactor.selectDate(rolloverDate.toDate());
        assert.equal(
          interactor.selectedYear(),
          rolloverDate.year(),
          'Selected year changed to rollover date year.'
        );
        assert.equal(
          interactor.selectedMonth(),
          rolloverDate.month(),
          'Selected month changed to rollover date month.'
        );
        assert.equal(
          interactor.selectedDay(),
          rolloverDate.date(),
          'Selected day changed to rollover date day.'
        );
        this.$('.done').click();
        resolve();
      });
    });
  });
});

test('rollover course prohibit non-matching day-of-week date selection', function(assert) {
  assert.expect(8);
  // rollover date and course start date don't fall on the same day of the week.
  const courseStartDate = moment().subtract(1, 'week').day(1);
  const rolloverDate = moment(courseStartDate).add(1, 'week').day(3);

  let course = Object.create({
    id: 1,
    startDate: courseStartDate.toDate()
  });
  let ajaxMock = Service.extend({
    request(url, {data}){
      assert.ok('newStartDate' in data, 'A new start date was passed.');
      let newStartDate = moment(data.newStartDate);
      assert.equal(
        newStartDate.format('YYYY-MM-DD'),
        courseStartDate.format('YYYY-MM-DD'),
        'New start date is course start date.'
      );
      return resolve({
        courses: [
          {
            id: 14
          }
        ]
      });
    }
  });
  this.register('service:ajax', ajaxMock);

  let storeMock = Service.extend({
    pushPayload(){},
    peekRecord(){},
    query(){return [];}
  });
  this.register('service:store', storeMock);
  getOwner(this).lookup('service:flash-messages').registerTypes(['success']);

  this.set('course', course);
  this.set('nothing', parseInt);
  this.render(hbs`{{course-rollover course=course visit=(action nothing)}}`);
  const advancedOptions = '.advanced-options';
  const title = `.advanced-options-title`;
  const startDate = `${advancedOptions} input:eq(0)`;

  return new Promise(resolve => {
    run(()=>{
      this.$(title).click();
      wait().then(()=>{
        let interactor = openDatepicker(this.$(startDate));
        assert.equal(
          interactor.selectedYear(),
          courseStartDate.year(),
          'Selected year initialized to course start date year.'
        );
        assert.equal(
          interactor.selectedMonth(),
          courseStartDate.month(),
          'Selected month initialized to course start date month.'
        );
        assert.equal(
          interactor.selectedDay(),
          courseStartDate.date(),
          'Selected day initialized to course start date day.'
        );
        interactor.selectDate(rolloverDate.toDate());
        assert.equal(
          interactor.selectedYear(),
          courseStartDate.year(),
          'Selected year is still to course start date year.'
        );
        assert.equal(
          interactor.selectedMonth(),
          courseStartDate.month(),
          'Selected month is still to course start date month.'
        );
        assert.equal(
          interactor.selectedDay(),
          courseStartDate.date(),
          'Selected day is still to course start date day.'
        );
        this.$('.done').click();
        resolve();
      });
    });
  });
});

test('rollover course with no offerings', function(assert) {
  assert.expect(3);
  let course = Object.create({
    id: 1
  });
  let ajaxMock = Service.extend({
    request(url, {data}){
      assert.ok('skipOfferings' in data);
      assert.equal(data.skipOfferings, true);

      return resolve({
        courses: [
          {
            id: 14
          }
        ]
      });
    }
  });
  this.register('service:ajax', ajaxMock);

  let storeMock = Service.extend({
    pushPayload(){},
    peekRecord(){},
    query(){return [];}
  });
  this.register('service:store', storeMock);
  getOwner(this).lookup('service:flash-messages').registerTypes(['success']);

  this.set('course', course);
  this.set('nothing', parseInt);
  this.render(hbs`{{course-rollover course=course visit=(action nothing)}}`);
  const advancedOptions = '.advanced-options';
  const title = `.advanced-options-title`;
  const offerings = `${advancedOptions} input:eq(1)`;

  return new Promise(resolve => {
    run(()=>{
      this.$(title).click();
      wait().then(()=>{
        assert.ok(this.$(offerings).is(':checked'));
        this.$(offerings).click();
        this.$(offerings).trigger('update');

        this.$('.done').click();
        resolve();
      });
    });
  });
});
