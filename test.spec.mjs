import Keyv from 'keyv';
import KeyvStore from './lib/index.js';
import fs from 'fs'
import keyvTestSuite, { keyvIteratorTests } from '@keyv/test-suite';
import * as test from 'vitest';

const store = () => new KeyvStore({
  filename: `./node_modules/.cache/test-save-${Math.random().toString(36).slice(2)}.json`,
});

const store2 = () => new KeyvStore({
  filename: `./node_modules/.cache/test-save-${Math.random().toString(36).slice(2)}`,
  keepCacheInMemory: false,
});

keyvTestSuite(test, Keyv, store);
keyvIteratorTests(test, Keyv, store);

keyvTestSuite(test, Keyv, store2);
keyvIteratorTests(test, Keyv, store2);

// test.it("single quotes value should be saved", async (t) => {

//   const keyv = new Keyv({ store: store2() });
//   let value = "'";
//   await keyv.set("key", value);
  // console.log('key set')
  // t.expect(await keyv.get("key")).toBe(value);
  // value = "''";
  // console.log('key get')
  // await keyv.set("key1", value);
  // console.log('key1 set')
  // t.expect(await keyv.get("key1")).toBe(value);
  // value = '"';
  // console.log('key1 get')
  // await keyv.set("key2", value);
  // console.log('key2 set')
  // t.expect(await keyv.get("key2")).toBe(value);
  // console.log('key2 get')
// })
