/**
 * Entry point. Registers the root component with the native runtime.
 */
import {AppRegistry} from 'react-native';

import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
