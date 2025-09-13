import Keyv from 'keyv';
import KeyvStore from './lib/index.js';
import keyvTestSuite, {keyvIteratorTests} from '@keyv/test-suite';
import * as test from 'vitest';

const store = () => new KeyvStore({
  filename: `./node_modules/.cache/test-save-${Math.random().toString(36).slice(2)}.json`,
});

keyvTestSuite(test, Keyv, store);
keyvIteratorTests(test, Keyv, store);
