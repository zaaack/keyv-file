import Keyv from 'keyv';
import KeyvStore from './lib/index.js';
import KeyvFileWithoutTTL from './lib/KeyvFileWithoutTTL.js';
import keyvTestSuite, {keyvIteratorTests} from '@keyv/test-suite';
import * as test from 'vitest';

const store = () => new KeyvStore({
  filename: `./node_modules/.cache/test-save-${Math.random().toString(36).slice(2)}.json`,
});
const store2 = () => new KeyvFileWithoutTTL({
  filename: `./node_modules/.cache/test2-save-${Math.random().toString(36).slice(2)}.json`,
});

keyvTestSuite(test, Keyv, store);
keyvIteratorTests(test, Keyv, store);

keyvTestSuite(test, Keyv, store2);
keyvIteratorTests(test, Keyv, store2);
