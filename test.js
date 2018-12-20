import Keyv from 'keyv';
import KeyvStore from './lib';
import keyvTestSuite from 'keyv-test-suite';
import test from 'ava';
import tk from 'timekeeper'

const store = () => new KeyvStore({
  filename: `./node_modules/.cache/test-save-${Math.random().toString(36).slice(2)}.json`,
});
keyvTestSuite(test, Keyv, store);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const sec = 1000
const minute = 60 * sec
const hour = 60 * minute
const day = 24 * hour
const week = 7 * day

test('support ttl', t => {
  t.true(store().ttlSupport)
})

test('save and clearExpire', async t => {
  const config = {
    filename: './node_modules/.cache/test-save.json',
    writeDelay: 100,
    expiredCheckDelay: 24 * 1000 * 3600,
  }
  let store2 = new KeyvStore(config)
  await store2.set('aa', 'bb', 3000)
  await store2.set('aa2', 'bb')

  t.is(await store2.get('aa'), 'bb')
  t.is(await store2.get('aa2'), 'bb')
  t.deepEqual(store2.keys(), ['aa', 'aa2'])
  store2 = null

  await sleep(200)
  const store3 = new KeyvStore(config)

  tk.travel(new Date(Date.now() + sec))
  t.is(await store3.get('aa'), 'bb')

  t.deepEqual(store3.keys(), ['aa', 'aa2'])

  tk.travel(new Date(Date.now() + 3 * sec))
  t.is(await store3.get('aa'), void 0)
  t.is(await store3.get('aa2'), 'bb')

  t.deepEqual(store3.keys(), ['aa2'])

  await store3.set('aa3', 'bb', 5 * hour)
  t.is(await store3.get('aa3'), 'bb')
  tk.travel(new Date(Date.now() + day + hour))
  t.true(store3._cache.has('aa3'))
  await store3.set('aa4', 1)
  t.false(store3._cache.has('aa3'))

  t.is(await store3.get('aa3'), void 0)
})
