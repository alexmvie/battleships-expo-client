import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import GameSetupScreen from './src/screens/GameSetupScreen';
import ShipPlacementScreen from './src/screens/ShipPlacementScreen';
import GameScreen from './src/screens/GameScreen';
import SocketTestScreen from './src/screens/SocketTestScreen';

const Stack = createStackNavigator();

export default function App() {
      return (
            <SafeAreaProvider>
                  <StatusBar barStyle='dark-content' />
                  <NavigationContainer>
                        <Stack.Navigator
                              initialRouteName='Home'
                              screenOptions={{
                                    headerShown: false,
                                    cardStyle: { backgroundColor: '#f0f8ff' },
                              }}
                        >
                              <Stack.Screen
                                    name='Home'
                                    component={HomeScreen}
                              />
                              <Stack.Screen
                                    name='GameSetup'
                                    component={GameSetupScreen}
                              />
                              <Stack.Screen
                                    name='ShipPlacement'
                                    component={ShipPlacementScreen}
                              />
                              <Stack.Screen
                                    name='Game'
                                    component={GameScreen}
                              />
                              <Stack.Screen
                                    name='SocketTest'
                                    component={SocketTestScreen}
                              />
                        </Stack.Navigator>
                  </NavigationContainer>
            </SafeAreaProvider>
      );
}
