import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== SENSOR SERVICE ====================
let accelerometerSubscription = null;
let gyroscopeSubscription = null;
let magnetometerSubscription = null;

const MAX_SENSOR_UPDATE_INTERVAL = 50; // Update interval in ms (50ms = 20 fps)

// Store current sensor values
let currentAccelerometer = { x: 0, y: 0, z: 0 };
let currentGyroscope = { x: 0, y: 0, z: 0 };
let currentMagnetometer = { x: 0, y: 0, z: 0 };

// Sensor availability status
let availableSensors = {
  accelerometer: false,
  gyroscope: false,
  magnetometer: false
};

// Initialize sensors and check availability
const initSensors = async () => {
  try {
    availableSensors.accelerometer = await Accelerometer.isAvailableAsync();
    availableSensors.gyroscope = await Gyroscope.isAvailableAsync();
    availableSensors.magnetometer = await Magnetometer.isAvailableAsync();
    
    // Set update intervals
    if (availableSensors.accelerometer) {
      Accelerometer.setUpdateInterval(MAX_SENSOR_UPDATE_INTERVAL);
    }
    
    if (availableSensors.gyroscope) {
      Gyroscope.setUpdateInterval(MAX_SENSOR_UPDATE_INTERVAL);
    }
    
    if (availableSensors.magnetometer) {
      Magnetometer.setUpdateInterval(MAX_SENSOR_UPDATE_INTERVAL);
    }
  } catch (error) {
    console.error('Failed to initialize sensors:', error);
    return false;
  }
  
  return true;
};

// Start sensor services
export const startSensorServices = async (callback, sensitivityMultiplier = 1.0) => {
  await initSensors();
  
  // Subscribe to accelerometer
  if (availableSensors.accelerometer) {
    accelerometerSubscription = Accelerometer.addListener(data => {
      currentAccelerometer = data;
      
      if (typeof callback === 'function') {
        callback(getSensorData());
      }
    });
  } else {
    console.warn('Accelerometer is not available on this device');
  }
  
  // Subscribe to gyroscope
  if (availableSensors.gyroscope) {
    gyroscopeSubscription = Gyroscope.addListener(data => {
      currentGyroscope = data;
      
      if (typeof callback === 'function') {
        callback(getSensorData());
      }
    });
  } else {
    console.warn('Gyroscope is not available on this device');
  }
  
  // Subscribe to magnetometer
  if (availableSensors.magnetometer) {
    magnetometerSubscription = Magnetometer.addListener(data => {
      currentMagnetometer = data;
      
      if (typeof callback === 'function') {
        callback(getSensorData());
      }
    });
  } else {
    console.warn('Magnetometer is not available on this device');
  }
  
  return true;
};

// Stop sensor services
export const stopSensorServices = () => {
  if (accelerometerSubscription) {
    accelerometerSubscription.remove();
    accelerometerSubscription = null;
  }
  
  if (gyroscopeSubscription) {
    gyroscopeSubscription.remove();
    gyroscopeSubscription = null;
  }
  
  if (magnetometerSubscription) {
    magnetometerSubscription.remove();
    magnetometerSubscription = null;
  }
};

// Get current sensor status
export const getSensorStatus = () => {
  return {
    ...availableSensors,
    accelerometerActive: !!accelerometerSubscription,
    gyroscopeActive: !!gyroscopeSubscription,
    magnetometerActive: !!magnetometerSubscription
  };
};

// Get current sensor data
export const getSensorData = () => {
  return {
    accelerometer: currentAccelerometer,
    gyroscope: currentGyroscope,
    magnetometer: currentMagnetometer
  };
};

// ==================== SOUND SERVICE ====================
// Sound configuration
export const SOUND_TYPES = {
  CHALLENGE_START: 'challengeStart',
  CHALLENGE_COMPLETE: 'challengeComplete',
  CHALLENGE_FAIL: 'challengeFail',
  STEP_DETECTED: 'stepDetected',
  TILT_DETECTED: 'tiltDetected',
  DIRECTION_MATCHED: 'directionMatched',
  UI_CLICK: 'uiClick'
};

// Sound objects
const soundObjects = {};

// Sound enabled state
let soundEnabled = true;

// Create dummy sound objects since we don't have real sound files
const emptySoundFiles = {
  [SOUND_TYPES.CHALLENGE_START]: null,
  [SOUND_TYPES.CHALLENGE_COMPLETE]: null,
  [SOUND_TYPES.CHALLENGE_FAIL]: null,
  [SOUND_TYPES.STEP_DETECTED]: null,
  [SOUND_TYPES.TILT_DETECTED]: null,
  [SOUND_TYPES.DIRECTION_MATCHED]: null,
  [SOUND_TYPES.UI_CLICK]: null
};

// Initialize the sound service
export const initSoundService = async () => {
  try {
    // Configure Audio mode
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
    
    // In this simplified version we don't actually load sound files
    // We'll just set up empty sound objects for demonstration purposes
    for (const type in SOUND_TYPES) {
      soundObjects[SOUND_TYPES[type]] = {
        stopAsync: async () => {},
        setPositionAsync: async () => {},
        playAsync: async () => {},
        unloadAsync: async () => {}
      };
    }
    
    // Load sound enabled state from storage
    const storedEnabled = await AsyncStorage.getItem('soundEnabled');
    if (storedEnabled !== null) {
      soundEnabled = storedEnabled === 'true';
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize sound service:', error);
    return false;
  }
};

// Play a sound
export const playSound = async (soundType) => {
  if (!soundEnabled || !soundObjects[soundType]) {
    return;
  }
  
  try {
    const sound = soundObjects[soundType];
    
    // Reset sound to beginning before playing
    await sound.stopAsync();
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.error(`Failed to play sound ${soundType}:`, error);
  }
};

// Set sound enabled state
export const setSoundEnabledState = async (enabled) => {
  soundEnabled = enabled;
  await AsyncStorage.setItem('soundEnabled', enabled ? 'true' : 'false');
};

// Unload sounds
export const unloadSounds = async () => {
  for (const type in soundObjects) {
    if (soundObjects[type]) {
      try {
        await soundObjects[type].unloadAsync();
      } catch (error) {
        console.error(`Failed to unload sound ${type}:`, error);
      }
    }
  }
  
  // Clear sound objects
  Object.keys(soundObjects).forEach(key => {
    delete soundObjects[key];
  });
};

// ==================== CHALLENGE LOGIC ====================
// Challenge types
export const CHALLENGE_TYPES = {
  RUN: 'RUN',
  ROTATE: 'ROTATE',
  TILT: 'TILT',
  DIRECTION: 'DIRECTION'
};

// Potential challenges to generate based on challenge type
const CHALLENGES = {
  [CHALLENGE_TYPES.RUN]: [
    { instruction: 'Run in place for 3 seconds', count: 3, intensity: 1.5, hint: 'Move up and down quickly' },
    { instruction: 'Take 5 steps forward', count: 5, intensity: 1.2, hint: 'Step forward with your device' },
    { instruction: 'Jump 3 times', count: 3, intensity: 2.0, hint: 'Quick vertical movements' },
    { instruction: 'March in place for 5 seconds', count: 5, intensity: 1.3, hint: 'Raise knees high' },
  ],
  [CHALLENGE_TYPES.ROTATE]: [
    { instruction: 'Rotate device 360° clockwise', degrees: 360, direction: 1, hint: 'Turn your device in a full circle' },
    { instruction: 'Rotate device 360° counter-clockwise', degrees: 360, direction: -1, hint: 'Turn your device in a full circle in the opposite direction' },
    { instruction: 'Rotate device 180° and back', degrees: 180, direction: 0, hint: 'Turn halfway around and return' },
    { instruction: 'Spin around with your device', degrees: 360, direction: 0, hint: 'Turn your whole body' },
  ],
  [CHALLENGE_TYPES.TILT]: [
    { instruction: 'Tilt device left then right', directions: ['left', 'right'], hint: 'Tilt from side to side' },
    { instruction: 'Tilt device forward then backward', directions: ['forward', 'backward'], hint: 'Tilt forward and backward' },
    { instruction: 'Tilt device in a circle', directions: ['left', 'forward', 'right', 'backward'], hint: 'Move in a circular pattern' },
    { instruction: 'Hold device tilted left for 3 seconds', directions: ['left'], duration: 3, hint: 'Keep it steady' },
  ],
  [CHALLENGE_TYPES.DIRECTION]: [
    { instruction: 'Face North', direction: 'N', tolerance: 20, hint: 'Use the compass to find North' },
    { instruction: 'Face East', direction: 'E', tolerance: 20, hint: 'Use the compass to find East' },
    { instruction: 'Face South', direction: 'S', tolerance: 20, hint: 'Use the compass to find South' },
    { instruction: 'Face West', direction: 'W', tolerance: 20, hint: 'Use the compass to find West' },
    { instruction: 'Rotate slowly to face South-East', direction: 'SE', tolerance: 20, hint: 'Between South and East' },
  ],
};

// Threshold values for movement detection
const THRESHOLDS = {
  STEP_MAGNITUDE: 1.2,
  ROTATION_SPEED: 0.5,
  TILT_ANGLE: 0.5,
  DIRECTION_TOLERANCE: 20, // degrees
};

// Variables to track state between checks
let lastAccelMagnitude = 0;
let stepCount = 0;
let rotationProgress = 0;
let tiltStates = [];
let directionMatched = false;
let lastDirectionMatchTime = 0;
let directionMatchDuration = 0;

// Generate a random challenge based on available sensors
export const generateChallenge = () => {
  // Get available sensors
  const sensors = getSensorStatus();
  
  // Build list of available challenge types based on sensors
  const availableChallengeTypes = [];
  
  if (sensors.accelerometer) {
    availableChallengeTypes.push(CHALLENGE_TYPES.RUN);
  }
  
  if (sensors.gyroscope) {
    availableChallengeTypes.push(CHALLENGE_TYPES.ROTATE);
    availableChallengeTypes.push(CHALLENGE_TYPES.TILT);
  }
  
  if (sensors.magnetometer) {
    availableChallengeTypes.push(CHALLENGE_TYPES.DIRECTION);
  }
  
  // If no sensors available, default to a simple challenge
  if (availableChallengeTypes.length === 0) {
    return {
      type: 'BASIC',
      instruction: 'Shake your device',
      hint: 'No advanced sensors detected, just shake the device',
    };
  }
  
  // Randomly select a challenge type
  const randomTypeIndex = Math.floor(Math.random() * availableChallengeTypes.length);
  const selectedType = availableChallengeTypes[randomTypeIndex];
  
  // Get challenges for this type
  const challengesForType = CHALLENGES[selectedType];
  
  // Randomly select a specific challenge
  const randomChallengeIndex = Math.floor(Math.random() * challengesForType.length);
  const selectedChallenge = challengesForType[randomChallengeIndex];
  
  // Return challenge with type and all properties
  return {
    type: selectedType,
    ...selectedChallenge
  };
};

// Reset tracking variables when a new challenge starts
export const resetChallengeTracking = () => {
  lastAccelMagnitude = 0;
  stepCount = 0;
  rotationProgress = 0;
  tiltStates = [];
  directionMatched = false;
  lastDirectionMatchTime = 0;
  directionMatchDuration = 0;
};

// Verify if the challenge has been completed
export const verifyChallengeCompletion = (challenge, sensorData, sensitivityMultiplier = 1.0) => {
  if (!challenge || !sensorData) {
    return { completed: false, performance: 0 };
  }
  
  // Apply sensitivity multiplier to thresholds
  const adjustedThresholds = {
    STEP_MAGNITUDE: THRESHOLDS.STEP_MAGNITUDE / sensitivityMultiplier,
    ROTATION_SPEED: THRESHOLDS.ROTATION_SPEED / sensitivityMultiplier,
    TILT_ANGLE: THRESHOLDS.TILT_ANGLE / sensitivityMultiplier,
    DIRECTION_TOLERANCE: THRESHOLDS.DIRECTION_TOLERANCE * sensitivityMultiplier,
  };
  
  switch (challenge.type) {
    case CHALLENGE_TYPES.RUN:
      return verifyRunChallenge(challenge, sensorData.accelerometer, adjustedThresholds);
    case CHALLENGE_TYPES.ROTATE:
      return verifyRotateChallenge(challenge, sensorData.gyroscope, adjustedThresholds);
    case CHALLENGE_TYPES.TILT:
      return verifyTiltChallenge(challenge, sensorData.gyroscope, adjustedThresholds);
    case CHALLENGE_TYPES.DIRECTION:
      return verifyDirectionChallenge(challenge, sensorData.magnetometer, adjustedThresholds);
    default:
      // For unknown challenge types, fallback to a simple check
      const magnitude = Math.sqrt(
        Math.pow(sensorData.accelerometer.x, 2) + 
        Math.pow(sensorData.accelerometer.y, 2) + 
        Math.pow(sensorData.accelerometer.z, 2)
      );
      
      // Simple shake detection
      if (magnitude > 2.5) {
        return { completed: true, performance: 0.7 };
      }
      
      return { completed: false, performance: 0 };
  }
};

// Verify running/stepping challenges
const verifyRunChallenge = (challenge, accelerometer, thresholds) => {
  // Calculate the magnitude of acceleration
  const magnitude = Math.sqrt(
    Math.pow(accelerometer.x, 2) + 
    Math.pow(accelerometer.y, 2) + 
    Math.pow(accelerometer.z, 2)
  );
  
  // Detect steps based on acceleration peaks
  const isStep = (
    magnitude > thresholds.STEP_MAGNITUDE && 
    lastAccelMagnitude <= thresholds.STEP_MAGNITUDE
  );
  
  // Track for next iteration
  lastAccelMagnitude = magnitude;
  
  if (isStep) {
    stepCount++;
    playSound(SOUND_TYPES.STEP_DETECTED);
  }
  
  // Check if we've reached the required count
  if (challenge.count && stepCount >= challenge.count) {
    // Calculate performance based on consistency
    const performance = Math.min(1.0, stepCount / challenge.count);
    
    // Reset for next challenge
    stepCount = 0;
    
    return { 
      completed: true, 
      performance: performance
    };
  }
  
  // Not completed yet
  return { 
    completed: false, 
    performance: challenge.count ? stepCount / challenge.count : 0
  };
};

// Verify rotation challenges
const verifyRotateChallenge = (challenge, gyroscope, thresholds) => {
  // For rotation, primarily use the z-axis of the gyroscope
  const rotationAxis = challenge.direction === 1 ? gyroscope.z : challenge.direction === -1 ? -gyroscope.z : Math.abs(gyroscope.z);
  
  // Accumulate rotation (converted to degrees)
  if (Math.abs(rotationAxis) > thresholds.ROTATION_SPEED) {
    rotationProgress += Math.abs(rotationAxis) * (180 / Math.PI) / 10; // Divide by 10 to scale appropriately
  }
  
  // Check if we've reached the required rotation
  if (challenge.degrees && rotationProgress >= challenge.degrees) {
    // Calculate performance
    const performance = Math.min(1.0, challenge.degrees / rotationProgress);
    
    // Reset for next challenge
    rotationProgress = 0;
    
    return { 
      completed: true, 
      performance: performance 
    };
  }
  
  // Not completed yet
  return { 
    completed: false, 
    performance: challenge.degrees ? rotationProgress / challenge.degrees : 0
  };
};

// Verify tilt challenges
const verifyTiltChallenge = (challenge, gyroscope, thresholds) => {
  let tiltDetected = '';
  
  // Detect which direction the device is tilting
  if (gyroscope.x > thresholds.TILT_ANGLE) {
    tiltDetected = 'forward';
  } else if (gyroscope.x < -thresholds.TILT_ANGLE) {
    tiltDetected = 'backward';
  } else if (gyroscope.y > thresholds.TILT_ANGLE) {
    tiltDetected = 'right';
  } else if (gyroscope.y < -thresholds.TILT_ANGLE) {
    tiltDetected = 'left';
  }
  
  // If we detected a tilt and it's new
  if (tiltDetected && (tiltStates.length === 0 || tiltStates[tiltStates.length - 1] !== tiltDetected)) {
    tiltStates.push(tiltDetected);
    playSound(SOUND_TYPES.TILT_DETECTED);
  }
  
  // For tilt duration challenges
  if (challenge.duration && tiltDetected === challenge.directions[0]) {
    if (lastDirectionMatchTime === 0) {
      lastDirectionMatchTime = Date.now();
    } else {
      directionMatchDuration = (Date.now() - lastDirectionMatchTime) / 1000;
      
      if (directionMatchDuration >= challenge.duration) {
        // Reset variables
        tiltStates = [];
        lastDirectionMatchTime = 0;
        directionMatchDuration = 0;
        
        return { completed: true, performance: 1.0 };
      }
    }
  } else {
    // Reset timer if not tilted correctly
    lastDirectionMatchTime = 0;
  }
  
  // Check if we've done all required tilt directions in order
  if (challenge.directions) {
    // Check if all directions have been hit in order
    let allDirectionsMatched = true;
    let directionIndex = 0;
    
    for (let i = 0; i < tiltStates.length && directionIndex < challenge.directions.length; i++) {
      if (tiltStates[i] === challenge.directions[directionIndex]) {
        directionIndex++;
      }
    }
    
    allDirectionsMatched = directionIndex === challenge.directions.length;
    
    if (allDirectionsMatched) {
      // Reset for next challenge
      tiltStates = [];
      
      return { 
        completed: true, 
        performance: 1.0 
      };
    }
  }
  
  // Not completed yet - calculate partial progress
  let progress = 0;
  if (challenge.directions) {
    progress = Math.min(tiltStates.length / challenge.directions.length, 1.0);
  } else if (challenge.duration) {
    progress = directionMatchDuration / challenge.duration;
  }
  
  return { 
    completed: false, 
    performance: progress
  };
};

// Verify direction challenges
const verifyDirectionChallenge = (challenge, magnetometer, thresholds) => {
  // Calculate heading
  const heading = Math.atan2(magnetometer.y, magnetometer.x) * (180 / Math.PI);
  const normalizedHeading = heading < 0 ? heading + 360 : heading;
  
  // Get target heading based on direction
  const targetHeading = getHeadingFromDirection(challenge.direction);
  
  // Calculate difference, accounting for wraparound
  let diff = Math.abs(normalizedHeading - targetHeading);
  if (diff > 180) {
    diff = 360 - diff;
  }
  
  // Check if we're within tolerance
  const tolerance = challenge.tolerance || thresholds.DIRECTION_TOLERANCE;
  const isMatched = diff <= tolerance;
  
  // For challenges that require holding a direction
  if (isMatched) {
    if (!directionMatched) {
      // First time matched
      directionMatched = true;
      lastDirectionMatchTime = Date.now();
      playSound(SOUND_TYPES.DIRECTION_MATCHED);
    } else {
      // Already matched, check if we've held it long enough
      const holdTime = (Date.now() - lastDirectionMatchTime) / 1000;
      if (holdTime >= 2) { // Require holding for 2 seconds
        // Reset for next challenge
        directionMatched = false;
        lastDirectionMatchTime = 0;
        
        return { 
          completed: true, 
          performance: 1.0 - (diff / tolerance)
        };
      }
    }
  } else {
    // Lost the match
    directionMatched = false;
    lastDirectionMatchTime = 0;
  }
  
  // Calculate progress based on how close we are to the target
  const progress = Math.max(0, 1.0 - (diff / 180));
  
  return { 
    completed: false, 
    performance: progress
  };
};

// Helper function to convert direction names to heading angles
const getHeadingFromDirection = (direction) => {
  switch (direction) {
    case 'N': return 0;
    case 'NE': return 45;
    case 'E': return 90;
    case 'SE': return 135;
    case 'S': return 180;
    case 'SW': return 225;
    case 'W': return 270;
    case 'NW': return 315;
    default: return 0;
  }
};

// ==================== STORAGE SERVICES ====================
// Keys for AsyncStorage
const HISTORY_KEY = 'stepmaster_history';
const SETTINGS_KEY = 'stepmaster_settings';
const THEME_KEY = 'stepmaster_theme';
const LANGUAGE_KEY = 'stepmaster_language';

// Default settings
const DEFAULT_SETTINGS = {
  sensitivity: 1.0,
  timeMultiplier: 1.0
};

// Save a completed challenge session to history
export const saveChallenge = async (challengeData) => {
  try {
    // Get existing history
    const existingDataJson = await AsyncStorage.getItem(HISTORY_KEY);
    const existingData = existingDataJson ? JSON.parse(existingDataJson) : [];
    
    // Add new challenge data
    const updatedData = [...existingData, challengeData];
    
    // Only keep the most recent 50 entries
    const trimmedData = updatedData.slice(-50);
    
    // Save back to storage
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedData));
    
    return true;
  } catch (error) {
    console.error('Failed to save challenge:', error);
    throw error;
  }
};

// Get challenge history
export const getHistory = async () => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
};

// Clear challenge history
export const clearHistory = async () => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear history:', error);
    throw error;
  }
};

// Set difficulty settings
export const setDifficultySettings = async (settings) => {
  try {
    // Merge with defaults to ensure all properties are set
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings
    };
    
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
};

// Get difficulty settings
export const getDifficultySettings = async () => {
  try {
    const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
    return settingsJson ? JSON.parse(settingsJson) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
};

// Set theme
export const setTheme = async (theme) => {
  try {
    await AsyncStorage.setItem(THEME_KEY, theme);
    return true;
  } catch (error) {
    console.error('Failed to save theme:', error);
    throw error;
  }
};

// Get theme
export const getTheme = async () => {
  try {
    const theme = await AsyncStorage.getItem(THEME_KEY);
    return theme || 'light'; // Default to light theme
  } catch (error) {
    console.error('Failed to get theme:', error);
    return 'light'; // Default to light theme on error
  }
};

// Set language
export const setLanguage = async (language) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    return true;
  } catch (error) {
    console.error('Failed to save language:', error);
    throw error;
  }
};

// Get language
export const getLanguage = async () => {
  try {
    const language = await AsyncStorage.getItem(LANGUAGE_KEY);
    return language || 'pt'; // Default to Portuguese
  } catch (error) {
    console.error('Failed to get language:', error);
    return 'pt'; // Default to Portuguese on error
  }
};