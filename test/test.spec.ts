import Keyv from 'keyv';
import KeyvStore from '../lib/index.js';
import fs from 'fs'
import keyvTestSuite, { keyvIteratorTests } from '@keyv/test-suite';
import * as test from 'vitest';
import { MsgpackGzipSerializer } from './msgpack-gzip-serializer.js';

const store = () => new KeyvStore({
  filename: `./node_modules/.cache/test1-${Math.random().toString(36).slice(2)}.json`,
});

const store2 = () => new KeyvStore({
  filename: `./node_modules/.cache/test2-${Math.random().toString(36).slice(2)}`,
  separatedFile: true
});

const store3 = () => new KeyvStore({
  filename: `./node_modules/.cache/test3-${Math.random().toString(36).slice(2)}`,
  separatedFile: true,
  ...MsgpackGzipSerializer,
});

keyvTestSuite(test, Keyv, store);
keyvIteratorTests(test, Keyv, store);

keyvTestSuite(test, Keyv, store2);
keyvIteratorTests(test, Keyv, store2);

keyvTestSuite(test, Keyv, store3);
keyvIteratorTests(test, Keyv, store3);
