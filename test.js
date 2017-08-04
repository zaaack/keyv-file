import test from 'ava';
import keyvTestSuite from 'keyv-test-suite';
import Keyv from 'keyv';
import KeyvStore from './';

const store = () => new KeyvStore();
keyvTestSuite(test, Keyv, store);
