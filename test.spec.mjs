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
  separatedFile: true
});

keyvTestSuite(test, Keyv, store);
keyvIteratorTests(test, Keyv, store);

keyvTestSuite(test, Keyv, store2);
keyvIteratorTests(test, Keyv, store2);
