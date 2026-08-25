/**
 * Entry point.
 *
 * registerRootComponent replaces AppRegistry.registerComponent: it wraps the
 * root component the way Expo Go and expo-dev-client need, and calls
 * AppRegistry itself underneath.
 */
import {registerRootComponent} from 'expo';

import App from './src/App';

registerRootComponent(App);
