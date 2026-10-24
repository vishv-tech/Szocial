/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner and in-memory TypeScript loader use CommonJS. */
require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryPosts, discoveryPosts, editPost } = require('../lib/feed.ts');
const { normalizeTimestamp, formatFullDateTime, formatRelativeTime, parseTimestamp } = require('../lib/date-time.ts');
const { getCoordinates, haversineDistanceKm } = require('../lib/nearby-ranking.ts');
const { normalizeUserLocation } = require('../lib/location.ts');
const { canMessage, isPairBlocked, orderedMessages, unreadMessages } = require('../lib/chat-rules.ts');
const loc = (latitude, longitude, area = 'Wadala') => ({ latitude, longitude, area, city: 'Mumbai' });
const here = loc(19.017, 72.858);
const post = (id, overrides = {}) => ({ id, type: 'fun', title: 'Cricket practice', description: 'Play badminton too', category: 'Sports', authorId: 'other', status: 'Active', createdAt: '2026-10-24T10:00:00Z', location: here, acceptedUserIds: [], ...overrides });
const near = post('near'), far = post('far', { location: loc(19.12, 72.85, 'Andheri'), createdAt: '2026-10-24T11:00:00Z' });
const ids = list => list.map(p => p.id);
test('UTC creation survives edits, including attempts to replace identity', () => {
 const original = post('id'); const updated = editPost(original, { createdAt: 'wrong', authorId: 'wrong', id: 'wrong', title: 'Changed' }, '2026-10-24T12:00:00Z');
 assert.equal(updated.createdAt, original.createdAt); assert.equal(updated.id, original.id); assert.equal(updated.authorId, original.authorId); assert.equal(updated.title, 'Changed');
});
test('historical and invalid timestamps never become today on refresh', () => {
 assert.equal(normalizeTimestamp('2026-06-12T10:00:00Z'), '2026-06-12T10:00:00.000Z');
 for (const value of ['yesterday', '2 hours ago', 'bad date', '']) assert.equal(normalizeTimestamp(normalizeTimestamp(value)), value);
});
test('IST formatting and relative time', () => {
 assert.match(formatFullDateTime('2026-10-24T10:00:00Z', 'Asia/Kolkata'), /3:30|15:30/);
 assert.equal(formatRelativeTime('2026-10-24T10:00:00Z', '2026-10-24T10:05:00Z'), '5 mins ago');
 assert.equal(formatRelativeTime('invalid'), 'Time unavailable');
});
test('Haversine distances and coordinate validation', () => {
 assert.equal(haversineDistanceKm(here, here), 0);
 assert.ok(haversineDistanceKm(here, far.location) > 11);
 assert.equal(getCoordinates(loc(91, 72)), null); assert.equal(getCoordinates(loc(19, 181)), null);
 assert.equal(normalizeUserLocation(loc(NaN, 20)).latitude, null);
});
for (const [mode, expected] of [['nearby', ['near','far']], ['farthest',['far','near']], ['newest',['far','near']], ['oldest',['near','far']]]) {
 test(mode + ' sorting', () => assert.deepEqual(ids(queryPosts([far,near], '', mode, here)), expected));
}
test('live location changes ranking', () => assert.deepEqual(ids(queryPosts([near,far], '', 'nearby', far.location)), ['far','near']));
test('unknown post locations retained after measured locations', () => assert.deepEqual(ids(queryPosts([post('unknown', {location: {area:'',city:''}}),near], '', 'nearby', here)), ['near','unknown']));
test('no location falls back to recency', () => assert.deepEqual(ids(queryPosts([near,far], '', 'nearby', {area:'',city:''})), ['far','near']));
test('manual locality fallback and stable ties', () => assert.deepEqual(ids(queryPosts([post('b'),post('a')], '', 'nearby', {area:'Wadala',city:'Mumbai'})), ['a','b']));
test('own help hidden, normal post retained, others help discoverable', () => assert.deepEqual(ids(discoveryPosts([post('ownhelp',{type:'help',authorId:'me'}),post('ownnormal',{authorId:'me'}),post('help',{type:'help'})], 'me')), ['ownnormal','help']));
test('private, removed and blocked authors excluded', () => {
 const block = { status:'Blocked', participantIds:['me','blocked'] };
 assert.deepEqual(discoveryPosts([post('private',{visibility:'Private after approval'}),post('removed',{status:'Removed'}),post('blocked',{authorId:'blocked'})], 'me', [block]), []);
});
for (const query of ['  CRICK  ', 'badmint', 'WADALA']) test('search partial/trim/case: '+query, () => assert.equal(queryPosts([near], query, 'nearby', here).length, 1));
test('search and sorting share a dataset; empty results', () => {
 assert.deepEqual(ids(queryPosts([near,far], 'cricket', 'newest', here)), ['far','near']);
 assert.deepEqual(queryPosts([near], 'nothingmatches', 'nearby', here), []);
 // Consumers may page the ordered result without duplicates or re-sorting each page.
 const rows=queryPosts([near,far], 'cricket','nearby',here); assert.equal(new Set([...rows.slice(0,1),...rows.slice(1)].map(x=>x.id)).size,2);
});
const chat = {id:'chat',status:'Active',participantIds:['me','other']};
test('only a participant can send; closed threads disallow messages', () => {
 assert.equal(canMessage([chat],chat,'me'),true); assert.equal(canMessage([chat],chat,'stranger'),false);
 assert.equal(canMessage([chat],chat,null),false); assert.equal(canMessage([chat],{...chat,status:'Left'},'me'),false);
});
test('block affects both directions and alternate threads, unblock restores messaging', () => {
 const blocked={...chat,id:'blocked',status:'Blocked',blockedById:'me'};
 assert.equal(isPairBlocked([blocked],chat.participantIds),true);
 for (const id of ['me','other']) assert.equal(canMessage([blocked,chat],chat,id),false);
 assert.equal(canMessage([{...blocked,status:'Active'},chat],chat,'other'),true);
});
test('receiving/history sorted chronologically and deduplicated by ID', () => {
 const first={id:'1',senderId:'me',text:'hello',createdAt:'2026-10-24T10:00:00Z'}, second={id:'2',senderId:'other',text:'hi',createdAt:'2026-10-24T11:00:00Z'};
 assert.deepEqual(orderedMessages([second,first,first]),[first,second]);
 assert.deepEqual(orderedMessages(JSON.parse(JSON.stringify([second,first]))),[first,second]);
});

test('invalid calendar dates rejected and offsetless ISO values consistently UTC', () => {
 assert.equal(parseTimestamp('2026-02-30T10:00:00Z'), null);
 assert.equal(normalizeTimestamp('2026-10-24T10:00:00'), '2026-10-24T10:00:00.000Z');
});
test('unread counts belong to the viewer, not the whole conversation', () => {
 const thread={...chat,messages:[{id:'1',senderId:'other',text:'hello',createdAt:'2026-10-24T10:00:00Z'}]};
 assert.equal(unreadMessages(thread,'me'),1); assert.equal(unreadMessages(thread,'other'),0); assert.equal(unreadMessages(thread,'stranger'),0);
 assert.equal(unreadMessages({...thread,readAtByParticipant:{me:'2026-10-24T11:00:00Z'}},'me'),0);
});
