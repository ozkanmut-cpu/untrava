import * as SecureStore from 'expo-secure-store';
import type { KeyValueStore } from './device-identity';

export const secureKeyValueStore: KeyValueStore = {
  getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  setItem(key, value) {
    return SecureStore.setItemAsync(key, value);
  },
};
